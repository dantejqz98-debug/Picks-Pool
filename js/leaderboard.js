(function (global) {
  "use strict";

  function entries() {
    return Array.isArray(global.allEntries) ? global.allEntries : [];
  }

  function fights() {
    return Array.isArray(global.fights) ? global.fights : [];
  }

  function results() {
    return global.fightResults || {};
  }

  function entryFee() {
    var fee = parseFloat(global.ENTRY_FEE);
    return isNaN(fee) ? 0 : fee;
  }

  function payoutSettings() {
    return global.payoutSettings || { places: 1 };
  }

  function esc(value) {
    if (typeof global.escapeHtml === "function") return global.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c];
    });
  }

  function currentPoolFeatureEnabled(featureName) {
    return typeof global.currentPoolFeatureEnabled === "function" ? global.currentPoolFeatureEnabled(featureName) : true;
  }

  function scoreEntry(entry) {
    return typeof global.calcScore === "function" ? global.calcScore(entry) : 0;
  }

  function isLocked() {
    return typeof global.isLocked === "function" ? global.isLocked() : false;
  }

  function casualPreviewEnabled() {
    try { return new URLSearchParams(global.location && global.location.search || "").get("casualPreview") === "1"; } catch (e) { return false; }
  }

  function fightHasResult(result) {
    return !!(result && (result.winner || result.method || result.timing || result.overUnderResult || result.status || result.resultStatus));
  }

  function casualStampEnabled() {
    return casualPreviewEnabled() || fights().some(function (fight) { return fightHasResult(results()[fight.id]); });
  }

  function isFreeStarterPool() {
    return typeof global.isFreeStarterPool === "function" ? global.isFreeStarterPool() : false;
  }

  function entryIdentity(entry) {
    if (typeof global.entryIdentity === "function") return global.entryIdentity(entry);
    return String((entry && (entry.docId || entry.memberId || entry.email || entry.name)) || "");
  }

  function doneCount() {
    if (typeof global.doneCount === "function") return global.doneCount();
    var n = 0;
    var fightResults = results();
    fights().forEach(function (fight) {
      var result = fightResults[fight.id];
      if (result && result.winner) n++;
    });
    return n;
  }

  function totalPrizePool() {
    return entries().length * entryFee();
  }

  function money(value) {
    value = Math.round(parseFloat(value) || 0);
    return "$" + value;
  }

  function payoutAmountFromPercent(total, percent) {
    return Math.round((parseFloat(total) || 0) * (parseFloat(percent) || 0) / 100);
  }

  function sanitizePayoutSettings(src) {
    src = src || {};
    var places = parseInt(src.places, 10);
    if (!(places === 1 || places === 2 || places === 3)) places = 1;
    var hasExplicitSplits = Array.isArray(src.splits) || Array.isArray(src.percentages);
    var splits = (src.splits || src.percentages || []).slice(0, 3).map(function (v) {
      v = parseFloat(v);
      return isNaN(v) ? 0 : Math.max(0, Math.min(100, v));
    });
    while (splits.length < 3) splits.push(0);
    if (!src.splits && !src.percentages && src.amounts) {
      var total = totalPrizePool();
      var amounts = (src.amounts || []).slice(0, 3).map(function (v) {
        v = parseFloat(v);
        return isNaN(v) ? 0 : Math.max(0, v);
      });
      while (amounts.length < 3) amounts.push(0);
      if (total > 0) {
        splits = amounts.map(function (v, i) {
          return i < places ? Math.max(0, Math.min(100, (v / total) * 100)) : 0;
        });
      }
    }
    var totalSplit = splits.slice(0, places).reduce(function (a, b) { return a + b; }, 0);
    var hasValidSavedSplit = Math.abs(totalSplit - 100) < 0.01;
    if (places === 1) {
      splits = [100, 0, 0];
    } else if (!hasExplicitSplits && !hasValidSavedSplit) {
      splits = places === 2 ? [70, 30, 0] : [60, 30, 10];
    }
    for (var i = places; i < 3; i++) splits[i] = 0;
    return {
      places: places,
      splits: splits,
      amounts: splits.map(function (v, i) {
        return i < places ? payoutAmountFromPercent(totalPrizePool(), v) : 0;
      })
    };
  }

  function payoutFormatName(settings) {
    var p = sanitizePayoutSettings(settings || payoutSettings());
    return p.places === 1 ? "Winner Takes All" : p.places === 2 ? "1st and 2nd" : "1st, 2nd, and 3rd";
  }

  function payoutSplitLabel(settings) {
    var p = sanitizePayoutSettings(settings || payoutSettings());
    var names = ["1st", "2nd", "3rd"];
    return names.slice(0, p.places).map(function (name, i) {
      return name + " " + (parseFloat(p.splits[i]) || 0) + "%";
    }).join(" · ");
  }

  function payoutAmountForPlace(place, total) {
    var p = sanitizePayoutSettings(payoutSettings());
    return place <= p.places ? payoutAmountFromPercent(total, p.splits[place - 1] || 0) : 0;
  }

  function payoutTrackerHtml() {
    var p = sanitizePayoutSettings(payoutSettings());
    return '<div class="leader-prize-format-line">Prize Format: ' + esc(payoutFormatName(p)) + " · " + esc(payoutSplitLabel(p)) + "</div>" +
      '<div class="leader-private-note">Private pool amounts are handled outside Fight Locks by the host and participants.</div>';
  }

  function payoutMapForScored(scored, total) {
    var out = {};
    var p = sanitizePayoutSettings(payoutSettings());
    var idx = 0;
    var place = 1;
    scored = Array.isArray(scored) ? scored : [];
    while (idx < scored.length && place <= p.places) {
      var score = scored[idx].sc;
      var group = [];
      while (idx < scored.length && scored[idx].sc === score) {
        group.push(scored[idx]);
        idx++;
      }
      var groupPot = 0;
      for (var pos = place; pos < place + group.length && pos <= p.places; pos++) {
        groupPot += payoutAmountForPlace(pos, total);
      }
      var each = group.length ? groupPot / group.length : 0;
      group.forEach(function (x) {
        out[x.e.docId || x.e.memberId || x.e.name] = each;
      });
      place += group.length;
    }
    return out;
  }

  function projectedPlayerGoal() {
    var meta = global.currentPoolMeta || {};
    var raw = parseInt(global.projectedPlayerGoalSetting || meta.projectedPlayerGoal || meta.playerGoal || meta.targetPlayers || 0, 10);
    if (isNaN(raw) || raw <= 0) return 0;
    var freeUnlimited = false;
    try {
      if (typeof global.currentFreePoolUnlimitedPlayersUnlocked === "function") freeUnlimited = !!global.currentFreePoolUnlimitedPlayersUnlocked();
      else freeUnlimited = !!(meta.freePoolUnlimitedPlayers || meta.launchCodeUnlimitedPlayers || meta.launchUnlockCodeApplied);
    } catch (e) {
      freeUnlimited = !!(meta.freePoolUnlimitedPlayers || meta.launchCodeUnlimitedPlayers || meta.launchUnlockCodeApplied);
    }
    if (isFreeStarterPool() && !freeUnlimited) raw = Math.min(raw, 5);
    return Math.max(raw, entries().length || 0);
  }

  function clearLeaderboardChampion(scored) {
    scored = Array.isArray(scored) ? scored : [];
    if (doneCount() <= 0 || !scored.length) return null;
    var topScore = scored[0].sc;
    if (topScore <= 0) return null;
    var topRows = scored.filter(function (x) { return x.sc === topScore; });
    return topRows.length === 1 ? topRows[0] : null;
  }

  function timingRoundNumber(timing) {
    if (typeof global.timingRoundNumber === "function") return global.timingRoundNumber(timing);
    var match = String(timing || "").match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  function parseStoppageMark(mark) {
    if (typeof global.parseStoppageMark === "function") return global.parseStoppageMark(mark);
    var match = String(mark || "").trim().match(/^([0-5]):([0-5]\d)$/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  function normalizeFightResultData(fight, raw) {
    return typeof global.normalizeFightResultData === "function" ? global.normalizeFightResultData(fight, raw || {}) : (raw || {});
  }

  function getActualFastestFinish() {
    var best = null;
    fights().forEach(function (fight) {
      var result = normalizeFightResultData(fight, results()[fight.id] || {});
      var method = String(result.method || "").toLowerCase();
      if (["ko", "tko", "sub", "doctor", "doctor_stoppage", "dq"].indexOf(method) < 0) return;
      if (!result.timing || result.timing === "distance" || !result.stoppageMark) return;
      var rn = timingRoundNumber(result.timing);
      var mark = parseStoppageMark(result.stoppageMark);
      if (rn === null || mark === null) return;
      var total = (rn - 1) * 300 + mark;
      if (!best || total < best.total) best = { fight: fight, round: "r" + rn, mark: result.stoppageMark, total: total };
    });
    return best;
  }

  function tieFromEntry(entry) {
    var props = typeof global.getEntryProps === "function" ? global.getEntryProps(entry) : {};
    var tie = props.fastestFinish || {};
    var round = String(tie.round || tie.r || "").toLowerCase().replace(/^round\s*/, "r");
    var mark = tie.mark || tie.time || tie.timeMark || "";
    if (typeof global.formatFastestFinishTime === "function" && mark) mark = global.formatFastestFinishTime(mark);
    return /^r[1-5]$/.test(round) && mark ? { round: round, mark: mark } : null;
  }

  function tieTotalSeconds(tie) {
    if (!tie) return null;
    var rn = parseInt(String(tie.round || "").replace(/\D/g, ""), 10);
    var mark = parseStoppageMark(tie.mark);
    if (isNaN(rn) || rn < 1 || rn > 5 || mark === null) return null;
    return (rn - 1) * 300 + mark;
  }

  function tieInfo(entry, actual) {
    if (!currentPoolFeatureEnabled("allowFastestFinishTiebreaker")) return null;
    var t = tieFromEntry(entry);
    var pred = tieTotalSeconds(t);
    if (!actual || pred === null) return null;
    return { prediction: t, diff: Math.abs(pred - actual.total), under: pred <= actual.total, predTotal: pred };
  }

  function fastestFinishTiedRows() {
    if (!currentPoolFeatureEnabled("allowFastestFinishTiebreaker")) {
      var plainRows = entries().map(function (e) { return { e: e, sc: scoreEntry(e), tie: null }; });
      plainRows.sort(function (a, b) { return b.sc - a.sc || String(a.e && a.e.name || "").localeCompare(String(b.e && b.e.name || "")); });
      return { rows: plainRows, actual: null };
    }
    var actual = getActualFastestFinish();
    var rows = entries().map(function (e) { return { e: e, sc: scoreEntry(e), tie: tieInfo(e, actual) }; });
    rows.sort(function (a, b) {
      var d = b.sc - a.sc;
      if (d) return d;
      if (actual) {
        var ad = a.tie ? a.tie.diff : 999999;
        var bd = b.tie ? b.tie.diff : 999999;
        if (ad !== bd) return ad - bd;
        var au = a.tie && a.tie.under ? 1 : 0;
        var bu = b.tie && b.tie.under ? 1 : 0;
        if (au !== bu) return bu - au;
      }
      return String(a.e && a.e.name || "").localeCompare(String(b.e && b.e.name || ""));
    });
    return { rows: rows, actual: actual };
  }

  function applyLeaderboardBannersPostRender() {
    try {
      if (typeof global.applyProfileBannersToLeaderboard !== "function") return;
      var tied = fastestFinishTiedRows();
      var order = tied && tied.actual ? tied.rows.map(function (row) { return row.e; }) : entries().map(function (e) {
        return { e: e, sc: scoreEntry(e) };
      }).sort(function (a, b) {
        return b.sc - a.sc;
      }).map(function (x) {
        return x.e;
      });
      global.applyProfileBannersToLeaderboard(order);
    } catch (e) {}
  }

  function applyLeaderboardTiebreakerPostRender() {
    var t = fastestFinishTiedRows();
    var actual = t.actual;
    var list = global.document && global.document.getElementById("lbList");
    if (!list) return;
    var rowEls = Array.prototype.slice.call(list.querySelectorAll(".lb-entry"));
    if (actual && rowEls.length) {
      var byName = {};
      rowEls.forEach(function (el) {
        var n = el.querySelector(".lb-name");
        var txt = n ? String(n.textContent || "") : "";
        entries().forEach(function (e) {
          if (txt.indexOf(String(e.name || "")) > -1) byName[entryIdentity(e)] = el;
        });
      });
      t.rows.forEach(function (row, idx) {
        var el = byName[entryIdentity(row.e)];
        if (!el) return;
        list.appendChild(el);
        var n = el.querySelector(".lb-name");
        if (n) n.textContent = (idx + 1) + ". " + (row.e.name || "");
      });
      rowEls = Array.prototype.slice.call(list.querySelectorAll(".lb-entry"));
    }
    if (rowEls.length) {
      var sourceRows = actual ? t.rows : entries().map(function (e) {
        return { e: e, sc: scoreEntry(e), tie: null };
      }).sort(function (a, b) {
        return b.sc - a.sc || String(a.e && a.e.name || "").localeCompare(String(b.e && b.e.name || ""));
      });
      rowEls.forEach(function (el, i) {
        var row = sourceRows[i];
        var info = row && row.tie;
        if (!row) return;
        var tied = sourceRows.filter(function (x) { return x.sc === row.sc; }).length > 1;
        var prize = el.querySelector(".leader-prize");
        if (actual && prize && tied) {
          prize.innerHTML = prize.innerHTML.replace("split by tie", '<span class="tie-resolved">ordered by fastest finish tiebreaker</span>');
        }
      });
    }
    if (actual && rowEls.length && !list.querySelector(".fastest-final-note")) {
      list.insertAdjacentHTML("afterbegin", '<div class="fastest-final-note">Actual Fastest Finish: ' + esc(String(actual.round).toUpperCase() + " at " + actual.mark) + "</div>");
    }
  }

  function afterRenderLeaderboard() {
    applyLeaderboardTiebreakerPostRender();
    applyLeaderboardBannersPostRender();
  }

  function renderLeaderboard() {
    if (!global.document) return;
    var lockedNow = isLocked();
    var goal = projectedPlayerGoal();
    var projectedTotal = goal ? goal * entryFee() : 0;
    var statGrid = global.document.querySelector("#view-leaderboard .stats-grid");
    if (statGrid) statGrid.classList.toggle("leader-stats-locked", lockedNow);
    var statEntries = global.document.getElementById("statEntries");
    if (statEntries) statEntries.textContent = entries().length;
    var statPrize = global.document.getElementById("statPrize");
    if (statPrize) statPrize.textContent = money(totalPrizePool());
    var prizeLabel = global.document.getElementById("statPrizeLabel");
    if (prizeLabel) prizeLabel.textContent = lockedNow ? "Final Pool Total" : "Current Pool Total";
    var projectedBox = global.document.getElementById("statProjectedBox");
    var projectedVal = global.document.getElementById("statProjected");
    if (projectedBox) projectedBox.style.display = lockedNow ? "none" : "";
    if (projectedVal) projectedVal.textContent = goal ? money(projectedTotal) : "Not Set";
    var statDone = global.document.getElementById("statDone");
    if (statDone) statDone.textContent = doneCount() + "/" + fights().length;
    var tracker = global.document.getElementById("leaderPayoutTracker");
    if (tracker) {
      tracker.classList.add("leader-payout-compact");
      tracker.innerHTML = payoutTrackerHtml();
    }
    var el = global.document.getElementById("lbList");
    if (!el) return;
    var currentEntries = entries();
    if (!currentEntries.length) {
      el.innerHTML = '<div class="empty">No entries yet — be the first!</div>';
      afterRenderLeaderboard();
      return;
    }
    global.__lastKnownAllPicksEntries = currentEntries.slice();
    var scored = currentEntries.map(function (e) { return { e: e, sc: scoreEntry(e) }; }).sort(function (a, b) { return b.sc - a.sc; });
    var championRow = clearLeaderboardChampion(scored);
    var championId = championRow ? entryIdentity(championRow.e) : "";
    var lastScore = null;
    var currentRank = 0;
    var showCasualStamp = casualStampEnabled() && scored.length > 1;
    var lowestScore = scored.length ? scored[scored.length - 1].sc : null;
    el.innerHTML = scored.map(function (x, index) {
      var e = x.e;
      if (x.sc !== lastScore) {
        currentRank++;
        lastScore = x.sc;
      }
      var isLeader = championId && entryIdentity(e) === championId;
      var isCasualLast = showCasualStamp && x.sc === lowestScore;
      var tiedCount = scored.filter(function (y) { return y.sc === x.sc; }).length;
      var rankLabel = (tiedCount > 1 ? "T-" + currentRank : currentRank) + ". ";
      var fighterCorrect = fights().filter(function (fight) {
        var result = results()[fight.id];
        return result && result.winner && e.picks && e.picks[fight.id] === result.winner;
      }).length;
      var casualStamp = isCasualLast ? '<div class="lb-casual-stamp" aria-label="Casual stamp">Casual</div>' : "";
      var leaderMain = '<div class="lb-top"><div><div class="lb-name">' + rankLabel + esc(e.name || "") + '</div><div class="lb-sub">' + fighterCorrect + " / " + fights().length + ' Fights Correct</div></div>' + casualStamp + '<div class="lb-pts">' + x.sc + " PT</div></div>";
      return '<div class="lb-entry' + (isLeader ? " leader" : "") + (isCasualLast ? " casual-preview-last" : "") + '">' + leaderMain + "</div>";
    }).join("");
    afterRenderLeaderboard();
    if (currentEntries.length && typeof global.renderAllPicks === "function" && !global.__allPicksRefreshFromLeaderboardQueued) {
      var allPicksEl = global.document && global.document.getElementById("allPicksContent");
      if (allPicksEl && !allPicksEl.querySelector(".ap-block")) {
        global.__allPicksRefreshFromLeaderboardQueued = true;
        global.setTimeout(function () {
          global.__allPicksRefreshFromLeaderboardQueued = false;
          try { global.renderAllPicks(); } catch (e) {}
        }, 0);
      }
    }
  }

  global.renderLeaderboard = renderLeaderboard;
  global.afterRenderLeaderboard = afterRenderLeaderboard;
  global.payoutTrackerHtml = payoutTrackerHtml;
  global.payoutFormatName = payoutFormatName;
  global.payoutSplitLabel = payoutSplitLabel;
  global.payoutAmountForPlace = payoutAmountForPlace;
  global.payoutMapForScored = payoutMapForScored;
  global.totalPrizePool = totalPrizePool;
  global.money = money;
  global.projectedPlayerGoal = projectedPlayerGoal;
  global.clearLeaderboardChampion = clearLeaderboardChampion;
  global.fastestFinishTiedRows = fastestFinishTiedRows;
})(window);
