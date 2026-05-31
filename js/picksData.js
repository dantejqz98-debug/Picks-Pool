(function (global) {
  "use strict";

  function objectOrEmpty(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function cloneMap(value) {
    return Object.assign({}, objectOrEmpty(value));
  }

  function normalizeRound(value) {
    if (typeof value === "number" && isFinite(value)) {
      value = String(Math.floor(value));
    }
    var raw = String(value || "").trim().toLowerCase();
    raw = raw.replace(/^round\s*/, "").replace(/^r/, "");
    var round = parseInt(raw, 10);
    return round >= 1 && round <= 5 ? round : null;
  }

  function parseFastestFinishTime(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && isFinite(value)) {
      value = String(Math.floor(value));
    }

    var raw = String(value || "").trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      if (raw.length <= 2) {
        raw = "0:" + String(parseInt(raw, 10) || 0).padStart(2, "0");
      } else {
        raw = String(parseInt(raw.slice(0, -2), 10) || 0) + ":" + raw.slice(-2);
      }
    }

    var match = raw.match(/^([0-5]):([0-5]\d)$/);
    if (!match) return null;

    var minutes = parseInt(match[1], 10);
    var seconds = parseInt(match[2], 10);
    var total = minutes * 60 + seconds;
    if (total > 300) total = 300;
    return { time: formatFastestFinishSeconds(total), seconds: total };
  }

  function formatFastestFinishSeconds(value) {
    var seconds = typeof value === "number" && isFinite(value) ? value : 0;
    seconds = Math.max(0, Math.min(300, Math.floor(seconds || 0)));
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }

  function formatFastestFinishTime(value) {
    var parsed = parseFastestFinishTime(value);
    return parsed ? parsed.time : "0:00";
  }

  function fastestCandidates(entry) {
    entry = objectOrEmpty(entry);
    var props = objectOrEmpty(entry.props);
    return [
      props.fastestFinish,
      props.fastestFinishTiebreaker,
      entry.fastestFinish,
      entry.fastestFinishTiebreaker
    ];
  }

  function normalizeFastestFinish(value) {
    value = objectOrEmpty(value);
    if (!Object.keys(value).length) return null;

    var round = normalizeRound(value.round || value.r || value.roundNumber);
    var timeValue = value.time || value.mark || value.timeMark;
    if ((timeValue === undefined || timeValue === null || timeValue === "") && typeof value.seconds === "number") {
      timeValue = formatFastestFinishSeconds(value.seconds);
    }

    var parsed = parseFastestFinishTime(timeValue);
    if (!round || !parsed) return null;

    return {
      round: round,
      time: parsed.time,
      seconds: parsed.seconds
    };
  }

  function getEntryFastestFinish(entry) {
    var candidates = fastestCandidates(entry);
    for (var i = 0; i < candidates.length; i++) {
      var normalized = normalizeFastestFinish(candidates[i]);
      if (normalized) return normalized;
    }
    return null;
  }

  function getEntryLockPick(entry) {
    entry = objectOrEmpty(entry);
    var props = objectOrEmpty(entry.props);
    return props.lock || props.lockPick || entry.lock || entry.lockPick || "";
  }

  function getEntryWinners(entry) {
    return cloneMap(objectOrEmpty(entry).picks);
  }

  function getEntryMethods(entry) {
    return cloneMap(objectOrEmpty(entry).methods);
  }

  function getEntryRounds(entry) {
    entry = objectOrEmpty(entry);
    var props = objectOrEmpty(entry.props);
    return cloneMap(props.timings || entry.timings);
  }

  function getEntryOvers(entry) {
    entry = objectOrEmpty(entry);
    var props = objectOrEmpty(entry.props);
    return cloneMap(props.overs || entry.overs);
  }

  function normalizeEntryProps(entry) {
    entry = objectOrEmpty(entry);
    var props = objectOrEmpty(entry.props);
    return {
      gloves: cloneMap(props.gloves || entry.gloves),
      timings: getEntryRounds(entry),
      overs: getEntryOvers(entry),
      lock: getEntryLockPick(entry),
      fastestFinish: getEntryFastestFinish(entry)
    };
  }

  function getEntryProps(entry) {
    return normalizeEntryProps(entry);
  }

  var api = {
    normalizeEntryProps: normalizeEntryProps,
    getEntryProps: getEntryProps,
    getEntryLockPick: getEntryLockPick,
    getEntryFastestFinish: getEntryFastestFinish,
    normalizeFastestFinish: normalizeFastestFinish,
    formatFastestFinishTime: formatFastestFinishTime,
    parseFastestFinishTime: parseFastestFinishTime,
    getEntryWinners: getEntryWinners,
    getEntryMethods: getEntryMethods,
    getEntryRounds: getEntryRounds,
    getEntryOvers: getEntryOvers
  };

  global.FightLocksPicksData = api;
  global.normalizeEntryProps = normalizeEntryProps;
  global.getEntryProps = getEntryProps;
  global.getEntryLockPick = getEntryLockPick;
  global.getEntryFastestFinish = getEntryFastestFinish;
  global.normalizeFastestFinish = normalizeFastestFinish;
  global.formatFastestFinishTime = formatFastestFinishTime;
  global.parseFastestFinishTime = parseFastestFinishTime;
  global.getEntryWinners = getEntryWinners;
  global.getEntryMethods = getEntryMethods;
  global.getEntryRounds = getEntryRounds;
  global.getEntryOvers = getEntryOvers;
})(window);
