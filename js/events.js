(function (global) {
  "use strict";

  var DEFAULT_EVENT_ID = "ufc-freedom-250";
  var DEFAULT_EVENT_NAME = "UFC Freedom 250";
  var DEFAULT_EVENT_LABEL = "Freedom 250 Card";
  var EVENT_STATUSES = ["draft", "upcoming", "open_for_picks", "locked", "live", "completed", "archived"];
  var DEFAULT_EVENT_STATUS = "open_for_picks";

  function safeEvents() {
    return global.EVENTS && typeof global.EVENTS === "object" ? global.EVENTS : {};
  }

  function defaultEvent() {
    return {
      eventId: DEFAULT_EVENT_ID,
      eventName: DEFAULT_EVENT_NAME,
      eventLabel: DEFAULT_EVENT_LABEL,
      eventStatus: DEFAULT_EVENT_STATUS,
      fights: Array.isArray(global.fights) ? global.fights : []
    };
  }

  function getStoredActiveEventId() {
    try {
      return global.localStorage && global.localStorage.getItem("fightLocksActiveEventId");
    } catch (e) {
      return "";
    }
  }

  function normalizeEventStatus(status) {
    status = String(status || DEFAULT_EVENT_STATUS).trim().toLowerCase();
    return EVENT_STATUSES.indexOf(status) > -1 ? status : DEFAULT_EVENT_STATUS;
  }

  function eventStatusDisplay(status) {
    return ({
      draft: "Draft",
      upcoming: "Upcoming",
      open_for_picks: "Open For Picks",
      locked: "Locked",
      live: "Live",
      completed: "Completed",
      archived: "Archived"
    })[normalizeEventStatus(status)] || "Upcoming";
  }

  function getActiveEventId() {
    var events = safeEvents();
    var active = global.activeEventId || getStoredActiveEventId() || DEFAULT_EVENT_ID;
    return events[active] ? active : DEFAULT_EVENT_ID;
  }

  function getEventById(eventId) {
    var events = safeEvents();
    var id = String(eventId || getActiveEventId()).trim() || DEFAULT_EVENT_ID;
    return normalizeFreedom250Event(events[id] || events[DEFAULT_EVENT_ID] || defaultEvent());
  }

  function isFreedom250Event(event) {
    event = event || {};
    var id = String(event.eventId || event.poolEventId || "").toLowerCase();
    var name = String(event.eventName || event.eventLabel || event.currentEvent || "").toLowerCase();
    return id === DEFAULT_EVENT_ID || id.indexOf("freedom-250") > -1 || name.indexOf("freedom 250") > -1;
  }

  function normalizeFreedom250Event(event) {
    if (!isFreedom250Event(event)) return event || {};
    return Object.assign({}, event || {}, {
      eventDate: event.eventDate || "Jun 14",
      eventTime: "7:00 PM",
      eventTimeZone: "CDT",
      picksLockAt: "",
      lockAt: "",
      startDateTime: "",
      sourceDateTime: ""
    });
  }

  function getCurrentPoolEvent(pool) {
    pool = pool || global.currentPoolMeta || {};
    return getEventById(pool.eventId || getActiveEventId());
  }

  function getCurrentEventFights(pool) {
    var event = getCurrentPoolEvent(pool);
    return event && Array.isArray(event.fights) ? event.fights : (Array.isArray(global.fights) ? global.fights : []);
  }

  function getEventStatus(event) {
    return normalizeEventStatus(event && (event.poolEventStatus || event.eventStatus || event.status));
  }

  function canEventAcceptPicks(event) {
    return getEventStatus(event) === "open_for_picks";
  }

  function isEventVisibleToUsers(event) {
    var status = getEventStatus(event);
    return status !== "draft" && status !== "archived";
  }

  function isEventCompleted(event) {
    var status = getEventStatus(event);
    return status === "completed" || status === "archived";
  }

  function getDefaultActiveEvent() {
    return getEventById(getActiveEventId());
  }

  function getActivePoolEvent(pool) {
    pool = pool || global.currentPoolMeta || {};
    var activePoolEventId = pool.activePoolEventId || pool.eventId || getActiveEventId();
    var poolEvents = pool.poolEvents || {};
    var poolEvent = poolEvents[activePoolEventId] || poolEvents[pool.eventId] || null;
    var base = getEventById((poolEvent && poolEvent.eventId) || pool.eventId || activePoolEventId);
    return normalizeFreedom250Event(Object.assign({}, base, poolEvent || {}, {
      poolEventId: (poolEvent && poolEvent.poolEventId) || activePoolEventId,
      eventId: (poolEvent && poolEvent.eventId) || base.eventId || DEFAULT_EVENT_ID,
      poolEventStatus: normalizeEventStatus((poolEvent && poolEvent.poolEventStatus) || pool.poolEventStatus || base.eventStatus)
    }));
  }

  function getPoolEventHistory(pool) {
    pool = pool || global.currentPoolMeta || {};
    var poolEvents = pool.poolEvents || {};
    var completed = Array.isArray(pool.completedPoolEventIds) ? pool.completedPoolEventIds : [];
    return completed.map(function (id) {
      return poolEvents[id] || getEventById(id);
    }).filter(Boolean);
  }

  function canActivePoolEventAcceptPicks(pool) {
    return canEventAcceptPicks(getActivePoolEvent(pool));
  }

  function upcomingUserEvents() {
    var allowed = { upcoming: 1, open_for_picks: 1, locked: 1, live: 1 };
    return Object.keys(safeEvents()).map(function (id) {
      return safeEvents()[id];
    }).filter(function (event) {
      return event && allowed[getEventStatus(event)] && isEventVisibleToUsers(event) && !isEventCompleted(event);
    }).slice(0, 8);
  }

  function setActiveEventId(eventId) {
    var event = getEventById(eventId);
    var nextId = event.eventId || DEFAULT_EVENT_ID;
    global.activeEventId = nextId;
    try {
      if (global.localStorage) global.localStorage.setItem("fightLocksActiveEventId", nextId);
    } catch (e) {}
    if (!global.selectedStartPoolEventId || !safeEvents()[global.selectedStartPoolEventId]) {
      global.selectedStartPoolEventId = nextId;
    }
    return nextId;
  }

  global.EVENT_STATUSES = EVENT_STATUSES;
  global.EVENT_LIFECYCLE_STATUSES = EVENT_STATUSES;
  global.DEFAULT_EVENT_ID = DEFAULT_EVENT_ID;
  global.DEFAULT_EVENT_NAME = DEFAULT_EVENT_NAME;
  global.DEFAULT_EVENT_LABEL = DEFAULT_EVENT_LABEL;
  global.DEFAULT_EVENT_STATUS = DEFAULT_EVENT_STATUS;
  global.normalizeEventStatus = normalizeEventStatus;
  global.eventStatusDisplay = eventStatusDisplay;
  global.getEventStatus = getEventStatus;
  global.getEventById = getEventById;
  global.normalizeFreedom250Event = normalizeFreedom250Event;
  global.getCurrentPoolEvent = getCurrentPoolEvent;
  global.getCurrentEventFights = getCurrentEventFights;
  global.isEventVisibleToUsers = isEventVisibleToUsers;
  global.canEventAcceptPicks = canEventAcceptPicks;
  global.isEventCompleted = isEventCompleted;
  global.getDefaultActiveEvent = getDefaultActiveEvent;
  global.getActivePoolEvent = getActivePoolEvent;
  global.getPoolEventHistory = getPoolEventHistory;
  global.canActivePoolEventAcceptPicks = canActivePoolEventAcceptPicks;
  global.upcomingUserEvents = upcomingUserEvents;
  global.getActiveEventId = getActiveEventId;
  global.setActiveEventId = setActiveEventId;
})(window);
