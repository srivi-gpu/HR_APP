/* Business rules and validation, from PRD section 14, with the error states of 17.

   Every rule is a function returning an error message or null, so screens can call them
   on a field and actions.js can call them all before writing. Keeping them here rather
   than inside forms means the same rule guards a form, a bulk import and an action. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var store = HRMS.store;

  function iso(d) { return HRMS.seed.util.iso(d); }
  function days(fromIso, toIso) {
    return Math.round((new Date(toIso + 'T00:00') - new Date(fromIso + 'T00:00')) / 86400000) + 1;
  }
  function isWeekend(d) { var k = d.getDay(); return k === 0 || k === 6; }
  function holidaySet() {
    var set = {};
    store.collection('holidays').forEach(function (hd) { if (hd.type !== 'Optional') set[hd.date] = hd.name; });
    return set;
  }

  /* Working days between two dates, excluding weekly offs and holidays (PRD 14.2). */
  function countLeaveDays(fromIso, toIso, halfDay) {
    var hol = holidaySet();
    var out = { total: 0, weekends: 0, holidays: 0, excluded: [] };
    var cur = new Date(fromIso + 'T00:00'), end = new Date(toIso + 'T00:00');
    while (cur <= end) {
      var key = iso(cur);
      if (isWeekend(cur)) { out.weekends++; out.excluded.push({ date: key, why: 'Weekly off' }); }
      else if (hol[key]) { out.holidays++; out.excluded.push({ date: key, why: hol[key] }); }
      else out.total++;
      cur.setDate(cur.getDate() + 1);
    }
    if (halfDay && out.total === 1) out.total = 0.5;
    return out;
  }

  /* ---------------------------------------------------- 14.1 Employee rules */
  var REQUIRED = 'Required';

  function uniqueEmployeeId(value, exceptId) {
    if (!value) return REQUIRED;
    var clash = store.collection('employees').some(function (e) {
      return e.id.toLowerCase() === String(value).toLowerCase() && e.id !== exceptId;
    });
    return clash ? 'Employee ID ' + value + ' is already in use' : null;
  }
  function uniqueWorkEmail(value, exceptId) {
    if (!value) return REQUIRED;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Enter a valid email address';
    var clash = store.collection('employees').some(function (e) {
      return e.workEmail && e.workEmail.toLowerCase() === String(value).toLowerCase() && e.id !== exceptId;
    });
    return clash ? 'This work email already belongs to another employee' : null;
  }
  function validJoiningDate(value) {
    if (!value) return REQUIRED;
    var d = new Date(value + 'T00:00');
    if (isNaN(d)) return 'Enter a valid date';
    if (d > HRMS.seed.util.addDays(HRMS.seed.today, 180)) return 'Joining date is more than six months away';
    return null;
  }

  /* Status transitions. An employee cannot jump from Draft straight to Exited, and an
     exited record cannot be reopened (PRD 3.3, 14.1). */
  var TRANSITIONS = {
    Draft: ['Invited', 'Archived'],
    Invited: ['Onboarding', 'Draft', 'Archived'],
    Onboarding: ['Probation', 'Active', 'Archived'],
    Probation: ['Active', 'Notice Period', 'Suspended', 'Archived'],
    Active: ['Probation', 'On Leave', 'Notice Period', 'Suspended', 'Archived'],
    'On Leave': ['Active', 'Notice Period', 'Suspended'],
    'Notice Period': ['Exited', 'Active'],
    Suspended: ['Active', 'Notice Period', 'Exited'],
    Exited: ['Archived'],
    Archived: []
  };
  function allowedStatuses(from) { return TRANSITIONS[from] || []; }
  function canTransition(from, to) {
    if (from === to) return 'The employee already has this status';
    return allowedStatuses(from).indexOf(to) >= 0 ? null
      : 'An employee cannot move from ' + from + ' to ' + to;
  }
  /* PRD 14.1: activation needs the mandatory onboarding information. */
  function canActivate(employee) {
    if (employee.status !== 'Onboarding' && employee.status !== 'Invited') return null;
    var onb = store.collection('onboarding').filter(function (o) { return o.employee === employee.id; })[0];
    if (!onb) return null;
    var mandatoryOpen = (onb.tasks || []).filter(function (t) { return t.mandatory && !t.done; });
    return mandatoryOpen.length
      ? mandatoryOpen.length + ' mandatory onboarding task' + (mandatoryOpen.length > 1 ? 's are' : ' is') + ' still open'
      : null;
  }

  /* ------------------------------------------------------- 14.2 Leave rules */
  function validDateRange(fromIso, toIso) {
    if (!fromIso || !toIso) return REQUIRED;
    if (toIso < fromIso) return 'The end date cannot be before the start date';
    if (days(fromIso, toIso) > 190) return 'That range is longer than any leave type allows';
    return null;
  }
  function overlappingLeave(employeeId, fromIso, toIso, exceptId) {
    var clash = store.collection('leaveRequests').filter(function (l) {
      return l.employee === employeeId && l.id !== exceptId
        && l.status !== 'Rejected' && l.status !== 'Cancelled'
        && l.from <= toIso && l.to >= fromIso;
    })[0];
    return clash ? 'This overlaps an existing request (' + clash.id + ', ' + clash.fromLabel + ' to ' + clash.toLabel + ')' : null;
  }
  function sufficientBalance(employeeId, typeId, requestedDays) {
    var type = store.leaveType(typeId);
    if (!type) return 'Choose a leave type';
    if (!type.paid || type.annual === 0) return null;          // unpaid and comp-off are not balance-bound
    var bal = store.balancesFor(employeeId).filter(function (b) { return b.type === typeId; })[0];
    if (!bal) return 'You are not eligible for ' + type.name + ' under your leave policy';
    return requestedDays > bal.available
      ? 'Insufficient balance: ' + requestedDays + ' day(s) requested, ' + bal.available + ' available'
      : null;
  }
  function withinMaxConsecutive(typeId, requestedDays) {
    var type = store.leaveType(typeId);
    if (!type || !type.maxConsecutive) return null;
    return requestedDays > type.maxConsecutive
      ? type.name + ' allows at most ' + type.maxConsecutive + ' consecutive days' : null;
  }
  function meetsNotice(typeId, fromIso) {
    var type = store.leaveType(typeId);
    if (!type || !type.notice) return null;
    var notice = Math.round((new Date(fromIso + 'T00:00') - HRMS.seed.today) / 86400000);
    return notice < type.notice
      ? type.name + ' needs ' + type.notice + ' day(s) notice; this gives ' + Math.max(0, notice) : null;
  }
  function eligibleForType(employee, typeId) {
    var policy = store.collection('leavePolicies').filter(function (p) { return p.id === employee.leavePolicy; })[0];
    if (!policy) return null;
    return policy.types.indexOf(typeId) >= 0 ? null
      : 'The ' + policy.name + ' policy does not include this leave type';
  }

  /* Everything a leave application must satisfy (PRD 4.12, 14.2). */
  function validateLeave(form, employee, exceptId) {
    var errors = {};
    if (!form.type) errors.type = REQUIRED;
    var range = validDateRange(form.from, form.to);
    if (range) errors.from = range;
    if (!errors.type && !errors.from) {
      var calc = countLeaveDays(form.from, form.to, form.halfDay);
      var e1 = eligibleForType(employee, form.type);
      var e2 = sufficientBalance(employee.id, form.type, calc.total);
      var e3 = withinMaxConsecutive(form.type, calc.total);
      var e4 = overlappingLeave(employee.id, form.from, form.to, exceptId);
      var e5 = meetsNotice(form.type, form.from);
      if (e1) errors.type = e1;
      else if (e2) errors.type = e2;
      else if (e3) errors.type = e3;
      if (e4) errors.from = e4;
      if (e5) errors.notice = e5;                              // a warning, not a blocker
      if (calc.total === 0) errors.from = 'That range has no working days in it';
      var docType = store.leaveType(form.type);
      if (docType && docType.docRequired && calc.total > 2 && !form.document) {
        errors.document = docType.name + ' over two days needs a supporting document';
      }
    }
    if (!form.reason || String(form.reason).trim().length < 3) errors.reason = 'Give a brief reason';
    return errors;
  }

  /* -------------------------------------------------- 14.3 Attendance rules */
  function canCheckIn(employeeId) {
    var today = HRMS.seed.todayIso;
    var rec = store.collection('attendanceToday').filter(function (a) { return a.employee === employeeId && a.date === today; })[0];
    var punch = store.pref('punch') || {};
    if (punch.date === today && punch.in) return 'You have already checked in today at ' + punch.in;
    if (rec && rec.checkIn && rec.status !== 'Missing Punch') return 'Attendance is already recorded for today';
    var onLeave = store.collection('leaveRequests').some(function (l) {
      return l.employee === employeeId && l.status === 'Approved' && l.from <= today && l.to >= today;
    });
    if (onLeave) return 'You are on approved leave today';
    return null;
  }
  function canCheckOut(employeeId) {
    var today = HRMS.seed.todayIso;
    var punch = store.pref('punch') || {};
    if (!(punch.date === today && punch.in)) return 'Check in before checking out';
    if (punch.out) return 'You have already checked out today at ' + punch.out;
    return null;
  }
  function validRegularization(form) {
    var errors = {};
    if (!form.date) errors.date = REQUIRED;
    else if (form.date > HRMS.seed.todayIso) errors.date = 'You cannot correct a future date';
    else if (form.date < HRMS.seed.util.iso(HRMS.seed.util.addDays(HRMS.seed.today, -30))) {
      errors.date = 'Corrections are allowed for the last 30 days only';
    }
    if (!form.issue) errors.issue = REQUIRED;
    if (!form.corrected || !/^\d{2}:\d{2}$/.test(form.corrected)) errors.corrected = 'Enter a time as HH:MM';
    if (!form.reason || String(form.reason).trim().length < 5) errors.reason = 'Explain the correction';
    return errors;
  }

  /* ------------------------------------------------------- 14.4 Shift rules */
  function validShift(form, exceptId) {
    var errors = {};
    if (!form.name) errors.name = REQUIRED;
    if (!form.code) errors.code = REQUIRED;
    else if (store.collection('shifts').some(function (s) { return s.code === form.code && s.id !== exceptId; })) {
      errors.code = 'Shift code ' + form.code + ' is already in use';
    }
    if (!/^\d{2}:\d{2}$/.test(form.start || '')) errors.start = 'Enter a time as HH:MM';
    if (!/^\d{2}:\d{2}$/.test(form.end || '')) errors.end = 'Enter a time as HH:MM';
    if (!errors.start && !errors.end && form.start === form.end) errors.end = 'Start and end cannot be the same';
    return errors;
  }
  /* Overnight shifts are legitimate, so a wrapped end time is not an error (14.4). */
  function shiftHours(shift) {
    var a = Number(shift.start.slice(0, 2)) * 60 + Number(shift.start.slice(3));
    var b = Number(shift.end.slice(0, 2)) * 60 + Number(shift.end.slice(3));
    var mins = (b - a + 1440) % 1440 - (shift.breakMins || 0);
    return Math.round((mins / 60) * 10) / 10;
  }
  function conflictingAssignment(employeeId, dateIso, exceptId) {
    var clash = store.collection('shiftAssignments').filter(function (x) {
      return x.employee === employeeId && x.date === dateIso && x.id !== exceptId;
    })[0];
    return clash ? 'This employee already has a shift assigned on ' + dateIso : null;
  }

  /* ------------------------------------------------------- 14.5 Asset rules */
  function canAllocate(assetId, employeeId) {
    var asset = store.find('assets', assetId);
    if (!asset) return 'That asset no longer exists';
    if (asset.status !== 'Available') return asset.name + ' is ' + asset.status.toLowerCase() + ' and cannot be allocated';
    if (asset.assignedTo && asset.assignedTo !== employeeId) return 'That asset already has an active assignment';
    return null;
  }
  function validAsset(form, exceptId) {
    var errors = {};
    if (!form.name) errors.name = REQUIRED;
    if (!form.category) errors.category = REQUIRED;
    if (!form.serial) errors.serial = REQUIRED;
    else if (store.collection('assets').some(function (a) { return a.serial === form.serial && a.id !== exceptId; })) {
      errors.serial = 'Serial number ' + form.serial + ' is already recorded';
    }
    if (form.value != null && Number(form.value) < 0) errors.value = 'Value cannot be negative';
    return errors;
  }

  /* ----------------------------------------------------- 14.6 Payroll rules */
  function payrollLocked(cycle) {
    return cycle && (cycle.status === 'Paid' || cycle.status === 'Finalized')
      ? cycle.period + ' is finalized and locked. Raise an adjustment instead of editing it.' : null;
  }
  function payrollInputsReady(cycle) {
    var s = store.stats();
    var problems = [];
    if (s.pendingRegs) problems.push(s.pendingRegs + ' attendance corrections pending');
    if (s.pendingLeave) problems.push(s.pendingLeave + ' leave requests pending');
    return problems;
  }
  function validSalaryStructure(form, exceptId) {
    var errors = {};
    if (!form.name) errors.name = REQUIRED;
    else if (store.collection('salaryStructures').some(function (s) { return s.name === form.name && s.id !== exceptId; })) {
      errors.name = 'A structure with that name already exists';
    }
    if (!form.effective) errors.effective = 'Salary changes need an effective date';
    return errors;
  }

  /* ------------------------------------------------- 14.7 Performance rules */
  function canSubmitSelf(assessment, employeeId) {
    if (!assessment) return 'You have no assessment in the open cycle';
    if (assessment.employee !== employeeId) return 'You can only submit an assessment assigned to you';
    if (assessment.self === 'Submitted') return 'Your self-assessment has already been submitted';
    return null;
  }
  function canReview(assessment, reviewerId) {
    if (!assessment) return 'That assessment no longer exists';
    if (assessment.reviewer !== reviewerId) return 'You are not the assigned reviewer for this employee';
    if (assessment.self !== 'Submitted') return 'The employee has not submitted a self-assessment yet';
    if (assessment.manager === 'Submitted') return 'Your review has already been submitted';
    return null;
  }

  /* ------------------------------------------------- 14.8 Offboarding rules */
  function validResignation(form) {
    var errors = {};
    if (!form.lastWorkingDay) errors.lastWorkingDay = REQUIRED;
    else if (form.lastWorkingDay <= HRMS.seed.todayIso) errors.lastWorkingDay = 'The last working day must be in the future';
    if (!form.reason) errors.reason = REQUIRED;
    return errors;
  }
  function noticeShortfall(lastWorkingDay, noticeDays) {
    var given = Math.round((new Date(lastWorkingDay + 'T00:00') - HRMS.seed.today) / 86400000);
    var required = noticeDays || 60;
    return given < required ? (required - given) + ' days short of the ' + required + '-day notice period' : null;
  }
  function outstandingClearance(employeeId) {
    var out = [];
    var held = store.collection('assets').filter(function (a) { return a.assignedTo === employeeId; });
    if (held.length) out.push(held.length + ' asset' + (held.length > 1 ? 's' : '') + ' still assigned');
    var openLeave = store.collection('leaveRequests').filter(function (l) {
      return l.employee === employeeId && l.status === 'Pending Approval';
    });
    if (openLeave.length) out.push(openLeave.length + ' pending leave request' + (openLeave.length > 1 ? 's' : ''));
    return out;
  }

  /* --------------------------------------------------------- Shared helpers */
  function required(fields, form) {
    var errors = {};
    fields.forEach(function (f) {
      var v = form[f.key];
      if (v == null || String(v).trim() === '') errors[f.key] = f.label ? f.label + ' is required' : REQUIRED;
    });
    return errors;
  }
  function uniqueIn(collectionName, field, value, exceptId, label) {
    if (!value) return null;
    var clash = store.collection(collectionName).some(function (row) {
      return String(row[field] || '').toLowerCase() === String(value).toLowerCase() && row.id !== exceptId;
    });
    return clash ? (label || value) + ' is already in use' : null;
  }
  function hasErrors(errors) { return Object.keys(errors || {}).some(function (k) { return k !== 'notice' && errors[k]; }); }

  HRMS.rules = {
    countLeaveDays: countLeaveDays, days: days, isWeekend: isWeekend,
    uniqueEmployeeId: uniqueEmployeeId, uniqueWorkEmail: uniqueWorkEmail, validJoiningDate: validJoiningDate,
    transitions: TRANSITIONS, allowedStatuses: allowedStatuses, canTransition: canTransition, canActivate: canActivate,
    validDateRange: validDateRange, overlappingLeave: overlappingLeave, sufficientBalance: sufficientBalance,
    withinMaxConsecutive: withinMaxConsecutive, meetsNotice: meetsNotice, eligibleForType: eligibleForType,
    validateLeave: validateLeave,
    canCheckIn: canCheckIn, canCheckOut: canCheckOut, validRegularization: validRegularization,
    validShift: validShift, shiftHours: shiftHours, conflictingAssignment: conflictingAssignment,
    canAllocate: canAllocate, validAsset: validAsset,
    payrollLocked: payrollLocked, payrollInputsReady: payrollInputsReady, validSalaryStructure: validSalaryStructure,
    canSubmitSelf: canSubmitSelf, canReview: canReview,
    validResignation: validResignation, noticeShortfall: noticeShortfall, outstandingClearance: outstandingClearance,
    required: required, uniqueIn: uniqueIn, hasErrors: hasErrors
  };
})();
