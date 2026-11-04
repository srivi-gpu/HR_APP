/* The functional actions of PRD 16.4.

   Every action validates through rules.js, writes through store.js, applies the
   cross-module consequences of PRD 5.1, and records an audit entry. Each returns
   { ok: true, ... } or { ok: false, errors: {field: message} } so a form can show
   field errors and a screen can show a toast.

   Screens never write to the store directly — they call these, so a rule cannot be
   bypassed by going through a different screen. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var store = HRMS.store, rules = HRMS.rules, seed = HRMS.seed;
  var iso = seed.util.iso, pretty = seed.util.pretty, addDays = seed.util.addDays;

  function fail(errors) { return { ok: false, errors: errors }; }
  function done(message, extra) { return Object.assign({ ok: true, message: message }, extra || {}); }
  function nameOf(id) { var e = store.employee(id); return e ? e.name : id; }
  function today() { return seed.todayIso; }

  /* An approval request, so anything needing a decision lands in the one inbox (PRD 6). */
  function raiseApproval(spec) {
    return store.add('approvals', {
      id: spec.id, kind: spec.kind, module: spec.module, employee: spec.employee,
      detail: spec.detail, submitted: today(), approver: spec.approver,
      status: 'Pending Approval', route: spec.route
    });
  }
  function closeApproval(id, status) {
    if (store.find('approvals', id)) store.setOverride('approvals', id, { status: status });
  }

  /* ===================================================== Employee records (4) */
  function createEmployee(form) {
    var errors = rules.required([
      { key: 'firstName', label: 'First name' }, { key: 'lastName', label: 'Last name' },
      { key: 'id', label: 'Employee ID' }, { key: 'workEmail', label: 'Work email' },
      { key: 'department', label: 'Department' }, { key: 'designation', label: 'Designation' },
      { key: 'type', label: 'Employment type' }, { key: 'location', label: 'Work location' }
    ], form);
    var dup = rules.uniqueEmployeeId(form.id);
    if (dup && !errors.id) errors.id = dup;
    var mail = rules.uniqueWorkEmail(form.workEmail);
    if (mail && !errors.workEmail) errors.workEmail = mail;
    var joined = rules.validJoiningDate(form.joined);
    if (joined) errors.joined = joined;
    if (rules.hasErrors(errors)) return fail(errors);

    var des = store.designation(form.designation);
    var name = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ');
    var ctc = Number(form.ctc) || 0;
    var record = {
      id: form.id, name: name, department: form.department,
      designation: des ? des.name : '', designationId: form.designation, level: des ? des.level : 1,
      type: form.type, status: form.status || 'Invited', location: form.location,
      joined: form.joined, joinedLabel: pretty(new Date(form.joined + 'T00:00')),
      workEmail: form.workEmail, personalEmail: form.personalEmail || '', phone: form.phone || '',
      ctc: ctc, dob: form.dob || '', gender: form.gender || '',
      probationMonths: form.type === 'Full-Time' ? 6 : 3,
      shift: form.shift || 'sh-gen',
      leavePolicy: form.leavePolicy || (form.type === 'Intern' ? 'lp-intern' : 'lp-standard'),
      attendancePolicy: 'ap-standard', manager: form.manager || null,
      salaryStructure: form.salaryStructure || 'ss-ic',
      bank: { name: form.bankName || '', account: form.bankAccount || '', ifsc: form.bankIfsc || '' },
      emergency: { name: form.emergencyName || '', relation: form.emergencyRelation || '', phone: form.emergencyPhone || '' },
      breakdown: seed.util.breakdown(ctc),
      createdHere: true
    };
    store.add('employees', record);
    store.add('employmentHistory', {
      id: store.nextId('employmentHistory', 'EH'), employee: record.id, on: today(),
      change: 'Employee record created', from: null, to: record.status
    });
    store.log('created the employee record for ' + name, 'User activity');

    /* PRD 5.1: a new employee record generates an onboarding checklist. */
    if (record.status === 'Invited' || record.status === 'Onboarding') {
      initiateOnboarding(record.id, form.onboardingTemplate || 'tpl-standard');
    }
    return done(name + ' added as ' + record.id, { employee: record });
  }

  function editEmployee(id, fields) {
    var current = store.employee(id);
    if (!current) return fail({ _: 'That employee no longer exists' });
    var errors = {};
    if (fields.workEmail && fields.workEmail !== current.workEmail) {
      var mail = rules.uniqueWorkEmail(fields.workEmail, id);
      if (mail) errors.workEmail = mail;
    }
    if (rules.hasErrors(errors)) return fail(errors);

    /* PRD 14.1 and 17: department, manager, location and salary changes are recorded. */
    var tracked = { department: 'Department', manager: 'Reporting manager', location: 'Work location',
      designation: 'Designation', ctc: 'Annual CTC', shift: 'Assigned shift', leavePolicy: 'Leave policy' };
    Object.keys(tracked).forEach(function (k) {
      if (fields[k] !== undefined && String(fields[k]) !== String(current[k])) {
        store.add('employmentHistory', {
          id: store.nextId('employmentHistory', 'EH'), employee: id, on: today(),
          change: tracked[k] + ' changed', from: String(current[k]), to: String(fields[k])
        });
      }
    });
    if (fields.ctc !== undefined && Number(fields.ctc) !== current.ctc) {
      fields.breakdown = seed.util.breakdown(Number(fields.ctc));
      if (!fields.salaryEffective) fields.salaryEffective = today();
    }
    store.setOverride('employees', id, fields);
    store.log('updated the employee record for ' + current.name, 'User activity');
    return done(current.name + ' updated');
  }

  /* PRD 4.5: an employee may propose a change to a sensitive field, but the record
     only updates once HR approves. The proposed value is parked on the request. */
  function requestProfileChange(employeeId, fields, label) {
    var employee = store.employee(employeeId);
    if (!employee) return fail({ _: 'Employee not found' });
    var open = store.collection('approvals').filter(function (a) {
      return a.kind === 'Profile Change' && a.employee === employeeId && a.status === 'Pending Approval';
    })[0];
    if (open) return fail({ _: 'You already have a profile change awaiting approval (' + open.id + ')' });

    var id = store.nextId('approvals', 'PC');
    var hr = (store.persona('hr') || {}).id;
    store.add('profileChanges', { id: id, employee: employeeId, fields: fields, requestedOn: today() });
    raiseApproval({
      id: id, kind: 'Profile Change', module: 'people', employee: employeeId,
      detail: (label || 'Profile details') + ' updated', approver: hr, route: 'hr/people/all'
    });
    store.log('requested a change to ' + (label || 'profile details').toLowerCase(), 'User activity');
    return done('Change submitted for HR approval', { id: id });
  }

  function changeEmployeeStatus(id, to, reason) {
    var e = store.employee(id);
    if (!e) return fail({ _: 'That employee no longer exists' });
    var bad = rules.canTransition(e.status, to);
    if (bad) return fail({ status: bad });
    if (to === 'Active') {
      var blocked = rules.canActivate(e);
      if (blocked) return fail({ status: blocked });
    }
    store.setOverride('employees', id, { status: to });
    store.add('employmentHistory', {
      id: store.nextId('employmentHistory', 'EH'), employee: id, on: today(),
      change: 'Status changed', from: e.status, to: to, reason: reason || null
    });
    store.log(e.name + ' moved from ' + e.status + ' to ' + to, 'User activity');

    /* PRD 5.1: exiting an employee revokes access and archives the record. */
    if (to === 'Exited') {
      var user = store.collection('users').filter(function (u) { return u.employee === id; })[0];
      if (user) store.setOverride('users', user.id, { status: 'Deactivated' });
    }
    return done(e.name + ' is now ' + to);
  }

  /* Bulk import (PRD 4.3 option B). Rows are validated individually so the summary can
     report which ones failed and why, rather than rejecting the whole file. */
  function importEmployees(rows) {
    var accepted = [], rejected = [];
    var seenIds = {}, seenMails = {};
    rows.forEach(function (row, i) {
      var problems = [];
      if (!row.id) problems.push('Employee ID missing');
      else if (seenIds[row.id]) problems.push('Duplicate Employee ID inside the file');
      else {
        var dup = rules.uniqueEmployeeId(row.id);
        if (dup) problems.push(dup);
      }
      if (!row.name) problems.push('Name missing');
      if (!row.workEmail) problems.push('Work email missing');
      else if (seenMails[row.workEmail]) problems.push('Duplicate work email inside the file');
      else {
        var mail = rules.uniqueWorkEmail(row.workEmail);
        if (mail) problems.push(mail);
      }
      if (!row.department || !store.department(row.department)) problems.push('Unknown department');
      var joined = rules.validJoiningDate(row.joined);
      if (joined) problems.push(joined);

      if (problems.length) { rejected.push({ line: i + 2, row: row, problems: problems }); return; }
      seenIds[row.id] = true; seenMails[row.workEmail] = true;
      accepted.push(row);
    });

    if (!rejected.length) {
      accepted.forEach(function (row) {
        var des = store.designation(row.designation) || seed.designations[0];
        store.add('employees', {
          id: row.id, name: row.name, department: row.department,
          designation: des.name, designationId: des.id, level: des.level,
          type: row.type || 'Full-Time', status: 'Invited', location: row.location || seed.locations[0].id,
          joined: row.joined, joinedLabel: pretty(new Date(row.joined + 'T00:00')),
          workEmail: row.workEmail, personalEmail: '', phone: row.phone || '',
          ctc: Number(row.ctc) || 0, dob: '', gender: '', probationMonths: 6,
          shift: 'sh-gen', leavePolicy: 'lp-standard', attendancePolicy: 'ap-standard',
          manager: row.manager || null, salaryStructure: 'ss-ic',
          bank: { name: '', account: '', ifsc: '' }, emergency: { name: '', relation: '', phone: '' },
          breakdown: seed.util.breakdown(Number(row.ctc) || 0), createdHere: true
        });
      });
      store.log('imported ' + accepted.length + ' employee records', 'User activity');
    }
    return { ok: !rejected.length, accepted: accepted, rejected: rejected };
  }

  /* ================================================ Organization structure (3.3) */
  function createDepartment(form) {
    var errors = rules.required([{ key: 'name', label: 'Department name' }, { key: 'code', label: 'Department code' }], form);
    var dup = rules.uniqueIn('departments', 'code', form.code, null, 'Department code ' + form.code);
    if (dup && !errors.code) errors.code = dup;
    var dupName = rules.uniqueIn('departments', 'name', form.name, null, form.name);
    if (dupName && !errors.name) errors.name = dupName;
    if (rules.hasErrors(errors)) return fail(errors);
    var record = {
      id: 'dep-' + form.code.toLowerCase(), code: form.code.toUpperCase(), name: form.name,
      head: form.head || null, headName: form.head ? nameOf(form.head) : null,
      parent: form.parent || null, location: form.location || null,
      status: form.status || 'Active', description: form.description || '', headcount: 0
    };
    store.add('departments', record);
    store.log('created the ' + form.name + ' department', 'Configuration');
    return done(form.name + ' created');
  }

  function createDesignation(form) {
    var errors = rules.required([{ key: 'name', label: 'Designation name' }, { key: 'code', label: 'Designation code' }], form);
    var dup = rules.uniqueIn('designations', 'code', form.code, null, 'Designation code ' + form.code);
    if (dup && !errors.code) errors.code = dup;
    if (!form.level) errors.level = 'Job level is required';
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('designations', {
      id: 'des-' + form.code.toLowerCase(), code: form.code.toUpperCase(), name: form.name,
      level: Number(form.level), reportsTo: form.reportsTo || null,
      description: form.description || '', status: form.status || 'Active'
    });
    store.log('created the ' + form.name + ' designation', 'Configuration');
    return done(form.name + ' created');
  }

  function createLocation(form) {
    var errors = rules.required([{ key: 'name', label: 'Location name' }, { key: 'address', label: 'Address' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('locations', {
      id: 'loc-' + form.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6),
      name: form.name, label: form.name, entity: form.entity || seed.entities[0].id,
      tz: form.tz || seed.org.timezone, address: form.address, headcount: 0, target: 0
    });
    store.log('added the ' + form.name + ' location', 'Configuration');
    return done(form.name + ' added');
  }

  function updateOrganization(fields) {
    store.setOverride('orgProfile', 'org', fields);
    store.log('updated the organization profile', 'Configuration');
    return done('Organization profile saved');
  }

  /* ====================================================== Users & roles (2.1) */
  function inviteUser(form) {
    var errors = rules.required([{ key: 'email', label: 'Work email' }, { key: 'role', label: 'Role' }], form);
    var mail = rules.uniqueIn('users', 'email', form.email, null, form.email);
    if (mail && !errors.email) errors.email = mail;
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('users', {
      id: store.nextId('users', 'USR'), employee: form.employee || null, email: form.email,
      role: form.role, status: 'Pending Invitation', lastSignIn: null, mfa: false, invitedOn: today()
    });
    store.log('invited ' + form.email + ' as ' + form.role, 'User activity');
    return done('Invitation sent to ' + form.email);
  }
  function setUserStatus(id, status) {
    var user = store.find('users', id);
    if (!user) return fail({ _: 'That user no longer exists' });
    store.setOverride('users', id, { status: status });
    store.log('set ' + user.email + ' to ' + status, 'Security');
    return done(user.email + ' is now ' + status.toLowerCase());
  }
  function setUserRole(id, role) {
    var user = store.find('users', id);
    if (!user) return fail({ _: 'That user no longer exists' });
    store.setOverride('users', id, { role: role });
    store.log('changed the role of ' + user.email + ' to ' + role, 'Permissions');
    return done(user.email + ' is now ' + role);
  }
  function createRole(form) {
    var errors = rules.required([{ key: 'name', label: 'Role name' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('customRoles', {
      id: store.nextId('customRoles', 'ROL'), name: form.name,
      description: form.description || '', basedOn: form.basedOn || 'me',
      modules: form.modules || {}, users: 0, status: 'Active'
    });
    store.log('created the custom role "' + form.name + '"', 'Permissions');
    return done(form.name + ' created');
  }

  /* ========================================================= Leave (4.11–4.14) */
  function createLeaveType(form) {
    var errors = rules.required([{ key: 'name', label: 'Leave name' }, { key: 'code', label: 'Leave code' }], form);
    var dup = rules.uniqueIn('leaveTypes', 'code', form.code, null, 'Leave code ' + form.code);
    if (dup && !errors.code) errors.code = dup;
    if (form.annual != null && Number(form.annual) < 0) errors.annual = 'Entitlement cannot be negative';
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('leaveTypes', {
      id: 'lt-' + form.code.toLowerCase(), code: form.code.toUpperCase(), name: form.name,
      paid: form.paid !== false, annual: Number(form.annual) || 0, carry: !!form.carry,
      maxAccrual: Number(form.maxAccrual) || 0, maxConsecutive: Number(form.maxConsecutive) || 0,
      notice: Number(form.notice) || 0, docRequired: !!form.docRequired, halfDay: form.halfDay !== false,
      status: 'Active'
    });
    store.log('created the ' + form.name + ' leave type', 'Configuration');
    return done(form.name + ' created');
  }

  function createLeavePolicy(form) {
    var errors = rules.required([{ key: 'name', label: 'Policy name' }], form);
    if (!form.types || !form.types.length) errors.types = 'Include at least one leave type';
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('leavePolicies', {
      id: store.nextId('leavePolicies', 'lp-'), name: form.name,
      appliesTo: form.appliesTo || 'All employees', types: form.types, status: 'Active'
    });
    store.log('created the ' + form.name + ' leave policy', 'Configuration');
    return done(form.name + ' created');
  }

  function applyLeave(employeeId, form) {
    var employee = store.employee(employeeId);
    if (!employee) return fail({ _: 'Employee not found' });
    var errors = rules.validateLeave(form, employee);
    if (rules.hasErrors(errors)) return fail(errors);

    var calc = rules.countLeaveDays(form.from, form.to, form.halfDay);
    var id = store.nextId('leaveRequests', 'LV');
    var type = store.leaveType(form.type);
    var approver = employee.manager || (store.persona('hr') || {}).id;
    store.add('leaveRequests', {
      id: id, employee: employeeId, type: form.type,
      from: form.from, to: form.to,
      fromLabel: pretty(new Date(form.from + 'T00:00')), toLabel: pretty(new Date(form.to + 'T00:00')),
      days: calc.total, halfDay: !!form.halfDay, reason: form.reason,
      status: 'Pending Approval', approver: approver, appliedOn: today(),
      decidedOn: null, decidedBy: null, document: form.document || null
    });
    raiseApproval({
      id: id, kind: 'Leave Request', module: 'leave', employee: employeeId,
      detail: type.name + ' · ' + calc.total + ' day' + (calc.total === 1 ? '' : 's') + ' from ' + pretty(new Date(form.from + 'T00:00')),
      approver: approver, route: 'hr/leave/requests'
    });
    store.log('applied for ' + type.name + ' (' + id + ')', 'User activity');
    return done('Leave request ' + id + ' submitted for approval', { id: id, days: calc.total });
  }

  /* PRD 5.1: approval updates the balance, the attendance calendar and payroll inputs. */
  function decideLeave(id, decision, comment) {
    var req = store.find('leaveRequests', id);
    if (!req) return fail({ _: 'That request no longer exists' });
    if (req.status !== 'Pending Approval') return fail({ _: 'That request has already been ' + req.status.toLowerCase() });

    store.setOverride('leaveRequests', id, {
      status: decision, decidedOn: today(),
      decidedBy: (store.persona(store.pref('role')) || {}).id, decisionComment: comment || null
    });
    closeApproval(id, decision);

    if (decision === 'Approved') {
      adjustBalance(req.employee, req.type, req.days);
      var covers = req.from <= today() && req.to >= today();
      if (covers) setAttendanceStatus(req.employee, 'On Leave');
      var type = store.leaveType(req.type);
      if (type && !type.paid) {
        store.add('payrollInputs', {
          id: store.nextId('payrollInputs', 'PI'), cycle: seed.payrollCycles[0].id,
          employee: req.employee, kind: 'Loss of pay', days: req.days, source: id
        });
      }
    }
    store.log(decision.toLowerCase() + ' leave request ' + id + ' for ' + nameOf(req.employee), 'User activity');
    return done('Leave request ' + id + ' ' + decision.toLowerCase());
  }
  function approveLeave(id, comment) { return decideLeave(id, 'Approved', comment); }
  function rejectLeave(id, comment) {
    if (!comment || String(comment).trim().length < 3) return fail({ comment: 'Give a reason for the rejection' });
    return decideLeave(id, 'Rejected', comment);
  }
  function cancelLeave(id) {
    var req = store.find('leaveRequests', id);
    if (!req) return fail({ _: 'That request no longer exists' });
    if (req.status === 'Approved' && req.to < today()) return fail({ _: 'Leave already taken cannot be cancelled' });
    var wasApproved = req.status === 'Approved';
    store.setOverride('leaveRequests', id, { status: 'Cancelled' });
    closeApproval(id, 'Cancelled');
    if (wasApproved) adjustBalance(req.employee, req.type, -req.days);   // PRD 14.2 recalculation
    store.log('cancelled leave request ' + id, 'User activity');
    return done('Leave request ' + id + ' cancelled');
  }

  function adjustBalance(employeeId, typeId, usedDelta) {
    var current = store.balancesFor(employeeId);
    var next = current.map(function (b) {
      return b.type === typeId
        ? Object.assign({}, b, { used: b.used + usedDelta, available: b.available - usedDelta })
        : b;
    });
    store.setBalances(employeeId, next);
  }
  function setAttendanceStatus(employeeId, status) {
    var rec = store.collection('attendanceToday').filter(function (a) { return a.employee === employeeId; })[0];
    if (rec) store.setOverride('attendanceToday', rec.id, { status: status });
  }

  /* ==================================================== Attendance (4.17–4.18) */
  function checkIn(employeeId) {
    var bad = rules.canCheckIn(employeeId);
    if (bad) return fail({ _: bad });
    var now = new Date();
    var at = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    store.setPref('punch', { date: today(), in: at });
    store.log('checked in at ' + at, 'User activity');
    return done('Checked in at ' + at, { at: at });
  }
  function checkOut(employeeId) {
    var bad = rules.canCheckOut(employeeId);
    if (bad) return fail({ _: bad });
    var punch = store.pref('punch') || {};
    var now = new Date();
    var at = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    store.setPref('punch', Object.assign({}, punch, { out: at }));
    store.log('checked out at ' + at, 'User activity');
    return done('Checked out at ' + at, { at: at });
  }

  function requestRegularization(employeeId, form) {
    var errors = rules.validRegularization(form);
    if (rules.hasErrors(errors)) return fail(errors);
    var employee = store.employee(employeeId);
    var id = store.nextId('regularizations', 'RG');
    var approver = employee.manager || (store.persona('hr') || {}).id;
    var d = new Date(form.date + 'T00:00');
    store.add('regularizations', {
      id: id, employee: employeeId, date: form.date, dateLabel: pretty(d),
      issue: form.issue, original: form.original || '— / —', corrected: form.corrected,
      reason: form.reason, status: 'Pending Approval', approver: approver
    });
    raiseApproval({
      id: id, kind: 'Attendance Regularization', module: 'attendance', employee: employeeId,
      detail: form.issue + ' on ' + pretty(d), approver: approver, route: 'hr/attendance/regularization'
    });
    store.log('raised attendance correction ' + id, 'User activity');
    return done('Correction ' + id + ' submitted for approval', { id: id });
  }

  function decideRegularization(id, decision, comment) {
    var req = store.find('regularizations', id);
    if (!req) return fail({ _: 'That request no longer exists' });
    if (req.status !== 'Pending Approval') return fail({ _: 'That request has already been ' + req.status.toLowerCase() });
    store.setOverride('regularizations', id, {
      status: decision, decidedOn: today(), decisionComment: comment || null
    });
    closeApproval(id, decision);
    /* PRD 14.3: the original value is kept; approval records the corrected one. */
    if (decision === 'Approved' && req.date === today()) setAttendanceStatus(req.employee, 'Present');
    store.log(decision.toLowerCase() + ' correction ' + id + ' for ' + nameOf(req.employee), 'User activity');
    return done('Correction ' + id + ' ' + decision.toLowerCase());
  }
  function approveRegularization(id, comment) { return decideRegularization(id, 'Approved', comment); }
  function rejectRegularization(id, comment) {
    if (!comment || String(comment).trim().length < 3) return fail({ comment: 'Give a reason for the rejection' });
    return decideRegularization(id, 'Rejected', comment);
  }

  /* ========================================================= Shifts (4.20–4.22) */
  function createShift(form) {
    var errors = rules.validShift(form);
    if (rules.hasErrors(errors)) return fail(errors);
    var record = {
      id: 'sh-' + form.code.toLowerCase(), code: form.code.toUpperCase(), name: form.name,
      start: form.start, end: form.end, breakMins: Number(form.breakMins) || 0,
      grace: Number(form.grace) || 0, night: form.start > form.end,
      days: form.days || 'Mon–Fri', allowance: Number(form.allowance) || 0, status: 'Active'
    };
    store.add('shifts', record);
    store.log('created the ' + form.name + ' shift', 'Configuration');
    return done(form.name + ' created');
  }

  function assignShift(employeeIds, shiftId, dates) {
    var ids = [].concat(employeeIds), assigned = 0, conflicts = [];
    ids.forEach(function (employeeId) {
      [].concat(dates).forEach(function (date) {
        var existing = store.collection('shiftAssignments').filter(function (x) {
          return x.employee === employeeId && x.date === date;
        })[0];
        if (existing) {
          if (existing.shift === shiftId) return;
          store.setOverride('shiftAssignments', existing.id, { shift: shiftId });
          conflicts.push({ employee: employeeId, date: date });
          assigned++;
          return;
        }
        store.add('shiftAssignments', {
          id: store.nextId('shiftAssignments', 'SA'), employee: employeeId,
          date: date, shift: shiftId, published: true, source: 'Manual'
        });
        assigned++;
      });
    });
    store.log('assigned ' + (store.shift(shiftId) || {}).name + ' to ' + ids.length + ' employee(s)', 'User activity');
    return done(assigned + ' assignment' + (assigned === 1 ? '' : 's') + ' saved'
      + (conflicts.length ? ', ' + conflicts.length + ' replaced an existing shift' : ''),
      { assigned: assigned, conflicts: conflicts });
  }

  function requestShiftSwap(employeeId, form) {
    var errors = rules.required([{ key: 'date', label: 'Date' }, { key: 'with', label: 'Replacement employee' },
      { key: 'to', label: 'Requested shift' }, { key: 'reason', label: 'Reason' }], form);
    if (form.with === employeeId) errors.with = 'Choose a different employee';
    if (form.date && form.date <= today()) errors.date = 'Choose a future date';
    if (rules.hasErrors(errors)) return fail(errors);
    var employee = store.employee(employeeId);
    var id = store.nextId('shiftSwaps', 'SW');
    var approver = employee.manager || (store.persona('hr') || {}).id;
    store.add('shiftSwaps', {
      id: id, employee: employeeId, with: form.with, date: form.date,
      from: form.from || employee.shift, to: form.to, reason: form.reason,
      counterpartyAgreed: false, status: 'Pending Approval', approver: approver
    });
    raiseApproval({
      id: id, kind: 'Shift Swap', module: 'shifts', employee: employeeId,
      detail: (store.shift(form.to) || {}).name + ' on ' + pretty(new Date(form.date + 'T00:00')),
      approver: approver, route: 'hr/shifts/swaps'
    });
    store.log('requested a shift swap (' + id + ')', 'User activity');
    return done('Swap request ' + id + ' submitted', { id: id });
  }

  function decideShiftSwap(id, decision) {
    var req = store.find('shiftSwaps', id);
    if (!req) return fail({ _: 'That request no longer exists' });
    if (req.status !== 'Pending Approval') return fail({ _: 'Already ' + req.status.toLowerCase() });
    store.setOverride('shiftSwaps', id, { status: decision });
    closeApproval(id, decision);
    if (decision === 'Approved') {
      assignShift(req.employee, req.to, [req.date]);
      assignShift(req.with, req.from, [req.date]);
    }
    store.log(decision.toLowerCase() + ' shift swap ' + id, 'User activity');
    return done('Swap ' + id + ' ' + decision.toLowerCase());
  }

  /* ================================================== Documents & policies (4.2x) */
  function uploadDocument(employeeId, form) {
    var errors = rules.required([{ key: 'category', label: 'Category' }, { key: 'name', label: 'File name' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    var id = store.nextId('employeeDocuments', 'DOC');
    store.add('employeeDocuments', {
      id: id, employee: employeeId, category: form.category, name: form.name,
      uploaded: today(), status: 'Pending Verification', verifiedBy: null,
      expiry: form.expiry || null, size: form.size || '— KB'
    });
    store.log('uploaded ' + form.name, 'User activity');
    return done(form.name + ' uploaded and sent for verification', { id: id });
  }
  function verifyDocument(id, decision, comment) {
    var doc = store.find('employeeDocuments', id);
    if (!doc) return fail({ _: 'That document no longer exists' });
    store.setOverride('employeeDocuments', id, {
      status: decision === 'Verified' ? 'Verified' : 'Rejected',
      verifiedBy: (store.persona(store.pref('role')) || {}).id,
      verifiedOn: today(), comment: comment || null
    });
    store.log(decision.toLowerCase() + ' ' + doc.name, 'User activity');
    return done(doc.name + ' ' + decision.toLowerCase());
  }

  function publishPolicy(form) {
    var errors = rules.required([{ key: 'name', label: 'Policy name' }, { key: 'category', label: 'Category' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    var id = store.nextId('policies', 'pol-');
    store.add('policies', {
      id: id, name: form.name, version: form.version || 'v1.0', category: form.category,
      ack: form.ack !== false, published: today(), audience: form.audience || 'All employees',
      due: form.due || null, body: form.body || ''
    });
    store.log('published ' + form.name + ' ' + (form.version || 'v1.0'), 'Configuration');
    /* PRD 5.1: publishing a policy generates an acknowledgement task. */
    return done(form.name + ' published to ' + (form.audience || 'all employees'), { id: id });
  }

  function acknowledgePolicy(employeeId, policyId) {
    var already = store.collection('acknowledgements').some(function (a) {
      return a.policy === policyId && a.employee === employeeId;
    });
    if (already) return fail({ _: 'You have already acknowledged this policy' });
    var policy = store.find('policies', policyId);
    store.add('acknowledgements', {
      id: store.nextId('acknowledgements', 'ACK'), policy: policyId, employee: employeeId, on: today()
    });
    store.log('acknowledged ' + (policy ? policy.name : policyId), 'User activity');
    return done((policy ? policy.name : 'Policy') + ' acknowledged');
  }

  /* ========================================================= Assets (4.29–4.32) */
  function addAsset(form) {
    var errors = rules.validAsset(form);
    if (rules.hasErrors(errors)) return fail(errors);
    var id = store.nextId('assets', 'AST');
    store.add('assets', {
      id: id, name: form.name, category: form.category, serial: form.serial,
      status: form.status || 'Available', assignedTo: null,
      location: form.location || seed.locations[0].id,
      purchased: form.purchased || today(),
      purchasedLabel: pretty(new Date((form.purchased || today()) + 'T00:00')),
      value: Number(form.value) || 0, warranty: form.warranty || null,
      condition: form.condition || 'Excellent', assignedOn: null, acknowledged: null
    });
    store.log('added asset ' + id + ' (' + form.name + ')', 'User activity');
    return done(form.name + ' added as ' + id, { id: id });
  }

  function allocateAsset(assetId, employeeId) {
    var bad = rules.canAllocate(assetId, employeeId);
    if (bad) return fail({ _: bad });
    store.setOverride('assets', assetId, {
      status: 'Assigned', assignedTo: employeeId, assignedOn: today(), acknowledged: false
    });
    var asset = store.find('assets', assetId);
    store.log('allocated ' + asset.name + ' to ' + nameOf(employeeId), 'User activity');
    return done(asset.name + ' allocated to ' + nameOf(employeeId));
  }

  function acknowledgeAsset(assetId) {
    store.setOverride('assets', assetId, { acknowledged: true, acknowledgedOn: today() });
    return done('Receipt acknowledged');
  }

  function requestAsset(employeeId, form) {
    var errors = rules.required([{ key: 'category', label: 'Asset category' }, { key: 'reason', label: 'Reason' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    var id = store.nextId('assetRequests', 'AR');
    var approver = (store.employeeByName('Sandeep Rao') || {}).id;
    store.add('assetRequests', {
      id: id, employee: employeeId, category: form.category, reason: form.reason,
      status: 'Pending Approval', requestedOn: today(), approver: approver
    });
    raiseApproval({
      id: id, kind: 'Asset Request', module: 'assets', employee: employeeId,
      detail: form.category + ' — ' + form.reason, approver: approver, route: 'hr/assets/requests'
    });
    store.log('requested a ' + form.category, 'User activity');
    return done('Request ' + id + ' submitted', { id: id });
  }

  function decideAssetRequest(id, decision, comment) {
    var req = store.find('assetRequests', id);
    if (!req) return fail({ _: 'That request no longer exists' });
    if (req.status !== 'Pending Approval') return fail({ _: 'Already ' + req.status.toLowerCase() });
    if (decision === 'Approved') {
      var free = store.collection('assets').filter(function (a) {
        return a.category === req.category && a.status === 'Available';
      })[0];
      if (!free) return fail({ _: 'No ' + req.category.toLowerCase() + ' is available in inventory' });
      store.setOverride('assetRequests', id, { status: 'Approved', fulfilledWith: free.id });
      allocateAsset(free.id, req.employee);
    } else {
      store.setOverride('assetRequests', id, { status: 'Rejected', comment: comment || null });
    }
    closeApproval(id, decision);
    store.log(decision.toLowerCase() + ' asset request ' + id, 'User activity');
    return done('Request ' + id + ' ' + decision.toLowerCase());
  }

  function returnAsset(assetId, condition) {
    var asset = store.find('assets', assetId);
    if (!asset) return fail({ _: 'That asset no longer exists' });
    if (!asset.assignedTo) return fail({ _: 'That asset is not currently assigned' });
    var holder = asset.assignedTo;
    /* PRD 14.5 and 5.1: returning updates inventory and keeps the history. */
    store.add('assetHistory', {
      id: store.nextId('assetHistory', 'AH'), asset: assetId, employee: holder,
      from: asset.assignedOn, to: today(), condition: condition || asset.condition
    });
    store.setOverride('assets', assetId, {
      status: condition === 'Damaged' ? 'Damaged' : condition === 'Needs service' ? 'Under Maintenance' : 'Available',
      assignedTo: null, assignedOn: null, acknowledged: null, condition: condition || asset.condition
    });
    store.log('recorded the return of ' + asset.name + ' from ' + nameOf(holder), 'User activity');
    return done(asset.name + ' returned');
  }

  /* ======================================================== Payroll (4.34–4.38) */
  function createSalaryStructure(form) {
    var errors = rules.validSalaryStructure(form);
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('salaryStructures', {
      id: store.nextId('salaryStructures', 'ss-'), name: form.name,
      levels: form.levels || 'Any', components: Number(form.components) || 9,
      effective: form.effective, status: 'Active'
    });
    store.log('created the ' + form.name + ' salary structure', 'Configuration');
    return done(form.name + ' created');
  }

  function initiatePayroll(form) {
    var errors = rules.required([{ key: 'period', label: 'Period' }, { key: 'payDate', label: 'Payment date' }], form);
    if (rules.uniqueIn('payrollCycles', 'period', form.period)) errors.period = 'A cycle already exists for ' + form.period;
    if (rules.hasErrors(errors)) return fail(errors);
    var id = store.nextId('payrollCycles', 'pay-');
    var eligible = store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited';
    });
    var gross = eligible.reduce(function (s, e) { return s + e.ctc / 12; }, 0);
    store.add('payrollCycles', {
      id: id, period: form.period, status: 'Draft', stage: 'Inputs pending',
      cutoff: form.cutoff || today(), payDate: form.payDate,
      employees: eligible.length, gross: Math.round(gross),
      deductions: Math.round(gross * 0.173), net: Math.round(gross * 0.827),
      employerCost: Math.round(gross * 1.12)
    });
    store.log('created the ' + form.period + ' payroll cycle', 'User activity');
    return done(form.period + ' payroll created', { id: id });
  }

  /* PRD 4.35: pull approved attendance and leave, then move to review. */
  function reviewPayroll(cycleId) {
    var cycle = store.find('payrollCycles', cycleId);
    if (!cycle) return fail({ _: 'That cycle no longer exists' });
    var locked = rules.payrollLocked(cycle);
    if (locked) return fail({ _: locked });
    var problems = rules.payrollInputsReady(cycle);
    store.setOverride('payrollCycles', cycleId, { status: 'In Review', stage: 'Under review' });
    store.log('moved ' + cycle.period + ' payroll to review', 'User activity');
    return done(cycle.period + ' is ready for review'
      + (problems.length ? ' — ' + problems.join(', ') : ''), { warnings: problems });
  }

  function finalizePayroll(cycleId) {
    var cycle = store.find('payrollCycles', cycleId);
    if (!cycle) return fail({ _: 'That cycle no longer exists' });
    var locked = rules.payrollLocked(cycle);
    if (locked) return fail({ _: locked });
    if (cycle.status === 'Draft') return fail({ _: 'Review the payroll before finalizing it' });
    store.setOverride('payrollCycles', cycleId, { status: 'Finalized', stage: 'Locked', finalizedOn: today() });
    store.log('finalized ' + cycle.period + ' payroll', 'User activity');
    return done(cycle.period + ' finalized and locked');
  }

  function generatePayslips(cycleId) {
    var cycle = store.find('payrollCycles', cycleId);
    if (!cycle) return fail({ _: 'That cycle no longer exists' });
    if (cycle.status !== 'Finalized' && cycle.status !== 'Paid') {
      return fail({ _: 'Finalize the payroll before generating payslips' });
    }
    var existing = store.collection('payslips').filter(function (p) { return p.cycle === cycleId; }).length;
    if (existing) return fail({ _: existing + ' payslips already exist for ' + cycle.period });
    var eligible = store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited';
    });
    eligible.forEach(function (e) {
      var b = e.breakdown || seed.util.breakdown(e.ctc);
      store.add('payslips', {
        id: store.nextId('payslips', 'PS'), cycle: cycleId, period: cycle.period, employee: e.id,
        gross: b.gross, deductions: b.totalDeductions, net: b.net,
        paidOn: cycle.payDate, status: 'Published', lopDays: 0
      });
    });
    store.setOverride('payrollCycles', cycleId, { status: 'Paid', stage: 'Completed' });
    store.log('generated ' + eligible.length + ' payslips for ' + cycle.period, 'User activity');
    return done(eligible.length + ' payslips published');
  }

  function submitTaxDeclaration(employeeId, form) {
    var existing = store.collection('taxDeclarations').filter(function (t) { return t.employee === employeeId; })[0];
    var fields = {
      regime: form.regime || 'New', declared: Number(form.declared) || 0,
      proofs: Number(form.proofs) || 0, status: 'Pending Verification', submittedOn: today()
    };
    if (existing) store.setOverride('taxDeclarations', existing.id, fields);
    else store.add('taxDeclarations', Object.assign({ id: store.nextId('taxDeclarations', 'TD'), employee: employeeId, year: 'FY 2026-27' }, fields));
    store.log('submitted a tax declaration', 'User activity');
    return done('Declaration submitted for verification');
  }

  /* ===================================================== Performance (4.43–4.46) */
  function createAppraisalCycle(form) {
    var errors = rules.required([{ key: 'name', label: 'Cycle name' }, { key: 'from', label: 'Start date' }, { key: 'to', label: 'End date' }], form);
    if (form.from && form.to && form.to < form.from) errors.to = 'The end date cannot be before the start date';
    if (rules.hasErrors(errors)) return fail(errors);
    var id = store.nextId('perfCycles', 'pc-');
    var eligible = store.collection('employees').filter(function (e) { return e.status === 'Active'; });
    store.add('perfCycles', {
      id: id, name: form.name, period: form.period || '', from: form.from, to: form.to,
      status: 'Scheduled', ratingScale: form.ratingScale || '1 – 5', eligible: eligible.length
    });
    store.log('created the ' + form.name + ' appraisal cycle', 'Configuration');
    return done(form.name + ' created', { id: id });
  }

  /* PRD 5.1: launching a cycle generates review tasks. */
  function launchAppraisalCycle(cycleId) {
    var cycle = store.find('perfCycles', cycleId);
    if (!cycle) return fail({ _: 'That cycle no longer exists' });
    if (cycle.status !== 'Scheduled') return fail({ _: cycle.name + ' is already ' + cycle.status.toLowerCase() });
    var eligible = store.collection('employees').filter(function (e) { return e.status === 'Active'; });
    var made = 0;
    eligible.forEach(function (e) {
      var has = store.collection('assessments').some(function (a) { return a.cycle === cycleId && a.employee === e.id; });
      if (has) return;
      store.add('assessments', {
        id: store.nextId('assessments', 'ASM'), cycle: cycleId, employee: e.id, reviewer: e.manager,
        self: 'Not Started', manager: 'Not Started', status: 'Awaiting Self-Assessment'
      });
      made++;
    });
    store.setOverride('perfCycles', cycleId, { status: 'Live' });
    store.log('launched ' + cycle.name + ' to ' + made + ' employees', 'User activity');
    return done(cycle.name + ' launched · ' + made + ' assessments created');
  }

  function createGoal(employeeId, form) {
    var errors = rules.required([{ key: 'title', label: 'Goal' }], form);
    if (form.weight != null && (Number(form.weight) < 0 || Number(form.weight) > 100)) errors.weight = 'Weight must be between 0 and 100';
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('goals', {
      id: store.nextId('goals', 'GL'), employee: employeeId, cycle: form.cycle || 'pc-h2-26',
      title: form.title, weight: Number(form.weight) || 0, progress: 0,
      status: 'Not Started', due: form.due || '2026-12-31'
    });
    store.log('added a goal', 'User activity');
    return done('Goal added');
  }
  function updateGoalProgress(id, progress) {
    var p = Math.max(0, Math.min(100, Number(progress) || 0));
    store.setOverride('goals', id, {
      progress: p, status: p === 100 ? 'Achieved' : p > 0 ? 'In Progress' : 'Not Started'
    });
    return done('Progress saved');
  }

  function submitSelfAssessment(employeeId, assessmentId, payload) {
    var a = store.find('assessments', assessmentId);
    var bad = rules.canSubmitSelf(a, employeeId);
    if (bad) return fail({ _: bad });
    if (!payload || !payload.summary || String(payload.summary).trim().length < 10) {
      return fail({ summary: 'Write a short summary of your half' });
    }
    store.setOverride('assessments', assessmentId, {
      self: 'Submitted', selfSubmittedOn: today(), selfSummary: payload.summary,
      selfRatings: payload.ratings || {}, status: 'Awaiting Manager'
    });
    store.log('submitted a self-assessment', 'User activity');
    return done('Self-assessment submitted');
  }

  function submitManagerReview(reviewerId, assessmentId, payload) {
    var a = store.find('assessments', assessmentId);
    var bad = rules.canReview(a, reviewerId);
    if (bad) return fail({ _: bad });
    if (!payload || !payload.rating) return fail({ rating: 'Give an overall rating' });
    store.setOverride('assessments', assessmentId, {
      manager: 'Submitted', managerSubmittedOn: today(), managerSummary: payload.summary || '',
      rating: Number(payload.rating), status: 'Manager Review Done'
    });
    store.log('submitted a manager review for ' + nameOf(a.employee), 'User activity');
    return done('Review submitted for ' + nameOf(a.employee));
  }

  function publishResults(cycleId) {
    var cycle = store.find('perfCycles', cycleId);
    if (!cycle) return fail({ _: 'That cycle no longer exists' });
    var open = store.collection('assessments').filter(function (a) {
      return a.cycle === cycleId && a.manager !== 'Submitted';
    });
    if (open.length) return fail({ _: open.length + ' reviews are still incomplete' });
    store.setOverride('perfCycles', cycleId, { status: 'Completed', publishedOn: today() });
    store.log('published results for ' + cycle.name, 'User activity');
    return done(cycle.name + ' results published');
  }

  /* ========================================================= Engagement (4.40) */
  function createSurvey(form) {
    var errors = rules.required([{ key: 'name', label: 'Survey name' }, { key: 'from', label: 'Start date' }, { key: 'to', label: 'End date' }], form);
    if (form.from && form.to && form.to < form.from) errors.to = 'The end date cannot be before the start date';
    if (!form.questions || !form.questions.length) errors.questions = 'Add at least one question';
    if (rules.hasErrors(errors)) return fail(errors);
    var id = store.nextId('surveys', 'sv-');
    var audience = store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited'
        && (!form.department || e.department === form.department)
        && (!form.location || e.location === form.location);
    });
    store.add('surveys', {
      id: id, name: form.name, type: form.type || 'Pulse', anonymous: form.anonymous !== false,
      from: form.from, to: form.to, status: form.from > today() ? 'Scheduled' : 'Live',
      questions: form.questions.length, questionList: form.questions,
      invited: audience.length, responded: 0
    });
    store.log('created the survey "' + form.name + '"', 'Configuration');
    return done(form.name + ' created for ' + audience.length + ' employees', { id: id });
  }

  function submitSurvey(employeeId, surveyId, answers) {
    var survey = store.find('surveys', surveyId);
    if (!survey) return fail({ _: 'That survey no longer exists' });
    if (survey.status !== 'Live') return fail({ _: survey.name + ' is ' + survey.status.toLowerCase() });
    var already = store.collection('surveyResponses').some(function (x) {
      return x.survey === surveyId && x.employee === employeeId;
    });
    if (already && !survey.anonymous) return fail({ _: 'You have already responded to this survey' });
    var employee = store.employee(employeeId);
    /* PRD 4.41: an anonymous survey must not store the respondent. */
    store.add('surveyResponses', {
      id: store.nextId('surveyResponses', 'SR'), survey: surveyId,
      employee: survey.anonymous ? null : employeeId,
      department: employee.department, submittedOn: today(), scores: answers || {}
    });
    store.setOverride('surveys', surveyId, { responded: survey.responded + 1 });
    store.setPref('surveysDone', (store.pref('surveysDone') || []).concat([surveyId]));
    store.log('submitted a response to ' + survey.name, 'User activity');
    return done('Thank you — your response has been recorded');
  }

  function giveRecognition(fromId, form) {
    var errors = rules.required([{ key: 'to', label: 'Colleague' }, { key: 'value', label: 'Value' }, { key: 'note', label: 'Note' }], form);
    if (form.to === fromId) errors.to = 'Choose a colleague other than yourself';
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('recognition', {
      id: store.nextId('recognition', 'RC'), to: form.to, from: fromId,
      value: form.value, note: form.note, on: today()
    });
    store.log('recognised ' + nameOf(form.to), 'User activity');
    return done('Recognition sent to ' + nameOf(form.to));
  }

  function submitFeedback(employeeId, form) {
    var errors = rules.required([{ key: 'category', label: 'Category' }, { key: 'note', label: 'Feedback' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('feedback', {
      id: store.nextId('feedback', 'FB'), employee: form.anonymous ? null : employeeId,
      category: form.category, note: form.note, on: today(), status: 'Open'
    });
    return done('Feedback submitted');
  }

  /* ----------------------------------------------- Announcements (PRD 4.39)
     Posting is HR's. Everyone else reads, reacts and comments, so the check lives
     here rather than only in the screen: a different screen cannot post around it.
     It is the workspace the viewer is signed into that decides, which is the same
     thing the rail and the route gate go by. */
  function canPostAnnouncements() { return store.pref('role') === 'hr'; }

  function postAnnouncement(form) {
    if (!canPostAnnouncements()) return fail({ _: 'Only HR can post an announcement' });
    var errors = rules.required([{ key: 'title', label: 'Title' }, { key: 'body', label: 'Announcement' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    var author = store.persona('hr');
    var id = store.nextId('announcements', 'an-');
    store.add('announcements', {
      id: id, title: form.title, body: form.body,
      by: author ? author.id : null, byName: author ? author.name : 'HR',
      on: today(), pinned: !!form.pinned
    });
    store.log('posted the announcement "' + form.title + '"', 'User activity');
    return done('Announcement posted', { id: id });
  }

  /* A reaction is one row per person per emoji, so this adds or removes rather than
     counting up and down. Reacting twice with the same emoji takes it back. */
  function toggleAnnouncementReaction(announcementId, emoji) {
    var me = store.persona(store.pref('role'));
    if (!me) return fail({ _: 'No signed-in employee' });
    if (!store.find('announcements', announcementId)) return fail({ _: 'Announcement not found' });
    var mine = store.collection('announcementReactions').filter(function (r) {
      return r.announcement === announcementId && r.employee === me.id && r.emoji === emoji;
    })[0];
    if (mine) {
      store.remove('announcementReactions', mine.id);
      return done(undefined, { reacted: false });
    }
    store.add('announcementReactions', {
      id: store.nextId('announcementReactions', 'ar-'),
      announcement: announcementId, employee: me.id, emoji: emoji
    });
    return done(undefined, { reacted: true });
  }

  function commentOnAnnouncement(announcementId, form) {
    var me = store.persona(store.pref('role'));
    if (!me) return fail({ _: 'No signed-in employee' });
    if (!store.find('announcements', announcementId)) return fail({ _: 'Announcement not found' });
    var errors = rules.required([{ key: 'body', label: 'Comment' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('announcementComments', {
      id: store.nextId('announcementComments', 'ac-'),
      announcement: announcementId, by: me.id, body: form.body,
      on: new Date().toISOString().slice(0, 16)
    });
    return done('Comment added');
  }

  function createActionPlan(form) {
    var errors = rules.required([{ key: 'title', label: 'Title' }, { key: 'owner', label: 'Owner' }, { key: 'due', label: 'Due date' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('actionPlans', {
      id: store.nextId('actionPlans', 'AP'), survey: form.survey || null, title: form.title,
      owner: form.owner, due: form.due, status: 'In Progress', finding: form.finding || ''
    });
    return done('Action plan created');
  }

  /* ====================================================== Onboarding (4.7–4.8) */
  function initiateOnboarding(employeeId, templateId) {
    var employee = store.employee(employeeId);
    if (!employee) return fail({ _: 'Employee not found' });
    var existing = store.collection('onboarding').filter(function (o) { return o.employee === employeeId; })[0];
    if (existing) return fail({ _: nameOf(employeeId) + ' already has an onboarding case' });
    var names = seed.onboardingTaskNames;
    var hr = (store.persona('hr') || {}).id;
    var it = (store.employeeByName('Sandeep Rao') || {}).id;
    var id = store.nextId('onboarding', 'ONB');
    store.add('onboarding', {
      id: id, employee: employeeId, template: templateId || 'tpl-standard',
      startDate: employee.joined, startDateLabel: employee.joinedLabel,
      tasksTotal: names.length, tasksDone: 0, pending: names.length, overdue: 0,
      stage: 'Yet to Start',
      tasks: names.map(function (t, i) {
        return {
          name: t, done: false,
          assignee: /IT|Asset/.test(t) ? it : /Manager|Department/.test(t) ? employee.manager : hr,
          due: iso(addDays(new Date(employee.joined + 'T00:00'), i + 1)),
          mandatory: i < 8
        };
      })
    });
    store.log('started onboarding for ' + employee.name, 'User activity');
    return done('Onboarding started for ' + employee.name, { id: id });
  }

  function completeOnboardingTask(caseId, taskName, doneFlag) {
    var c = store.find('onboarding', caseId);
    if (!c) return fail({ _: 'That onboarding case no longer exists' });
    var tasks = (c.tasks || []).map(function (t) {
      return t.name === taskName ? Object.assign({}, t, { done: doneFlag !== false, completedOn: today() }) : t;
    });
    var completed = tasks.filter(function (t) { return t.done; }).length;
    store.setOverride('onboarding', caseId, {
      tasks: tasks, tasksDone: completed, pending: tasks.length - completed,
      stage: completed === tasks.length ? 'Completed' : completed > 6 ? 'Pending Verification' : 'In Progress'
    });
    store.log((doneFlag === false ? 'reopened' : 'completed') + ' "' + taskName + '" for ' + nameOf(c.employee), 'User activity');
    if (completed === tasks.length) {
      return done('Onboarding complete for ' + nameOf(c.employee) + ' — the employee can now be activated');
    }
    return done('"' + taskName + '" ' + (doneFlag === false ? 'reopened' : 'completed'));
  }

  /* ===================================================== Offboarding (4.49–4.50) */
  function submitResignation(employeeId, form) {
    var errors = rules.validResignation(form);
    if (rules.hasErrors(errors)) return fail(errors);
    var existing = store.collection('offboarding').filter(function (o) {
      return o.employee === employeeId && o.stage !== 'Completed';
    })[0];
    if (existing) return fail({ _: 'A resignation is already in progress' });
    var employee = store.employee(employeeId);
    var id = store.nextId('offboarding', 'OFB');
    var names = seed.offboardingTaskNames;
    var hr = (store.persona('hr') || {}).id;
    var it = (store.employeeByName('Sandeep Rao') || {}).id;
    store.add('offboarding', {
      id: id, employee: employeeId, resignedOn: today(), resignedOnLabel: pretty(seed.today),
      lastWorkingDay: form.lastWorkingDay,
      lastWorkingDayLabel: pretty(new Date(form.lastWorkingDay + 'T00:00')),
      noticeDays: 60, reason: form.reason, comments: form.comments || '',
      stage: 'Submitted', status: 'Pending Approval',
      tasksTotal: names.length, tasksDone: 0, clearance: 0,
      assetsOutstanding: store.collection('assets').filter(function (a) { return a.assignedTo === employeeId; }).length,
      settlement: 'Pending',
      tasks: names.map(function (t) {
        return { name: t, done: false, owner: /Asset|Access/.test(t) ? it : hr };
      })
    });
    raiseApproval({
      id: id, kind: 'Resignation', module: 'offboarding', employee: employeeId,
      detail: 'Last working day ' + pretty(new Date(form.lastWorkingDay + 'T00:00')),
      approver: hr, route: 'hr/offboarding/resignations'
    });
    store.log('submitted a resignation (' + id + ')', 'User activity');
    var shortfall = rules.noticeShortfall(form.lastWorkingDay, 60);
    return done('Resignation submitted' + (shortfall ? ' — note: ' + shortfall : ''), { id: id, shortfall: shortfall });
  }

  /* PRD 5.1: an approved resignation initiates offboarding. */
  function decideResignation(id, decision, comment) {
    var c = store.find('offboarding', id);
    if (!c) return fail({ _: 'That case no longer exists' });
    if (c.status !== 'Pending Approval') return fail({ _: 'Already ' + c.status.toLowerCase() });
    closeApproval(id, decision);
    if (decision === 'Approved') {
      store.setOverride('offboarding', id, { stage: 'Notice Period', status: 'In Progress', approvedOn: today() });
      changeEmployeeStatus(c.employee, 'Notice Period', 'Resignation approved');
      store.log('approved the resignation of ' + nameOf(c.employee), 'User activity');
      return done('Resignation approved — notice period has begun');
    }
    store.setOverride('offboarding', id, { stage: 'Rejected', status: 'Rejected', comment: comment || null });
    store.log('rejected the resignation of ' + nameOf(c.employee), 'User activity');
    return done('Resignation rejected');
  }

  function completeOffboardingTask(caseId, taskName, doneFlag) {
    var c = store.find('offboarding', caseId);
    if (!c) return fail({ _: 'That case no longer exists' });
    /* PRD 14.8: asset return cannot be ticked while assets are still out. */
    if (taskName === 'Asset return' && doneFlag !== false) {
      var held = store.collection('assets').filter(function (a) { return a.assignedTo === c.employee; });
      if (held.length) return fail({ _: held.length + ' asset(s) are still assigned. Record the returns first.' });
    }
    var tasks = (c.tasks || []).map(function (t) {
      return t.name === taskName ? Object.assign({}, t, { done: doneFlag !== false, completedOn: today() }) : t;
    });
    var completed = tasks.filter(function (t) { return t.done; }).length;
    store.setOverride('offboarding', caseId, {
      tasks: tasks, tasksDone: completed,
      clearance: Math.round((completed / tasks.length) * 100),
      assetsOutstanding: store.collection('assets').filter(function (a) { return a.assignedTo === c.employee; }).length
    });
    store.log('completed "' + taskName + '" for ' + nameOf(c.employee), 'User activity');
    return done('"' + taskName + '" ' + (doneFlag === false ? 'reopened' : 'completed'));
  }

  function recordSettlement(caseId, amount) {
    var c = store.find('offboarding', caseId);
    if (!c) return fail({ _: 'That case no longer exists' });
    var outstanding = rules.outstandingClearance(c.employee);
    if (outstanding.length) return fail({ _: 'Clearance is incomplete: ' + outstanding.join(', ') });
    store.setOverride('offboarding', caseId, { settlement: 'Paid', settlementAmount: Number(amount) || 0, settledOn: today() });
    store.log('recorded the final settlement for ' + nameOf(c.employee), 'User activity');
    return done('Final settlement recorded');
  }

  function completeOffboarding(caseId) {
    var c = store.find('offboarding', caseId);
    if (!c) return fail({ _: 'That case no longer exists' });
    if (c.tasksDone < c.tasksTotal) return fail({ _: (c.tasksTotal - c.tasksDone) + ' clearance tasks are still open' });
    if (c.settlement !== 'Paid') return fail({ _: 'Record the final settlement first' });
    store.setOverride('offboarding', caseId, { stage: 'Completed', status: 'Completed', completedOn: today() });
    changeEmployeeStatus(c.employee, 'Exited', 'Offboarding completed');
    return done(nameOf(c.employee) + ' has exited and the record is archived');
  }

  /* ========================================================== Approval inbox
     One entry point for PRD 6.5, dispatching to the module action that owns the
     record so the cross-module effects in 5.1 always run. A kind with no dedicated
     action just closes the request. */
  function decideApproval(id, decision, comment) {
    var a = store.find('approvals', id);
    if (!a) return fail({ _: 'That request no longer exists' });
    if (a.status !== 'Pending Approval') return fail({ _: 'That request has already been ' + a.status.toLowerCase() });
    if (decision === 'Rejected' && (!comment || String(comment).trim().length < 3)) {
      return fail({ comment: 'Give a reason for the rejection' });
    }
    switch (a.kind) {
      case 'Leave Request':
        return decision === 'Approved' ? approveLeave(id) : rejectLeave(id, comment);
      case 'Attendance Regularization':
        return decision === 'Approved' ? approveRegularization(id) : rejectRegularization(id, comment);
      case 'Asset Request':
        return decideAssetRequest(id, decision, comment);
      case 'Shift Swap':
        return decideShiftSwap(id, decision);
      case 'Resignation':
        return decideResignation(id, decision, comment);
      case 'Profile Change':
        /* Approval is what actually writes the proposed values (PRD 4.5). */
        var proposed = store.find('profileChanges', id);
        if (decision === 'Approved' && proposed) store.setOverride('employees', proposed.employee, proposed.fields);
        closeApproval(id, decision);
        store.log(decision.toLowerCase() + ' a profile change for ' + nameOf(a.employee), 'User activity');
        return done('Profile change ' + decision.toLowerCase());
      default:
        closeApproval(id, decision);
        store.log(decision.toLowerCase() + ' ' + a.kind.toLowerCase() + ' ' + id, 'User activity');
        return done(a.kind + ' ' + id + ' ' + decision.toLowerCase());
    }
  }

  /* ============================================================ Session (16.4) */
  function switchRole(roleId) {
    store.setPref('role', roleId);
    HRMS.router.go(HRMS.nav.role(roleId).home);
    return done('Switched to the ' + HRMS.nav.role(roleId).label + ' workspace');
  }

  HRMS.actions = {
    /* Employee records */
    createEmployee: createEmployee, editEmployee: editEmployee,
    changeEmployeeStatus: changeEmployeeStatus, importEmployees: importEmployees,
    requestProfileChange: requestProfileChange,
    /* Organization */
    createDepartment: createDepartment, createDesignation: createDesignation,
    createLocation: createLocation, updateOrganization: updateOrganization,
    /* Users & roles */
    inviteUser: inviteUser, setUserStatus: setUserStatus, setUserRole: setUserRole, createRole: createRole,
    /* Leave */
    createLeaveType: createLeaveType, createLeavePolicy: createLeavePolicy,
    applyLeave: applyLeave, approveLeave: approveLeave, rejectLeave: rejectLeave, cancelLeave: cancelLeave,
    /* Attendance */
    checkIn: checkIn, checkOut: checkOut, requestRegularization: requestRegularization,
    approveRegularization: approveRegularization, rejectRegularization: rejectRegularization,
    /* Shifts */
    createShift: createShift, assignShift: assignShift,
    requestShiftSwap: requestShiftSwap, decideShiftSwap: decideShiftSwap,
    /* Documents */
    uploadDocument: uploadDocument, verifyDocument: verifyDocument,
    publishPolicy: publishPolicy, acknowledgePolicy: acknowledgePolicy,
    /* Assets */
    addAsset: addAsset, allocateAsset: allocateAsset, acknowledgeAsset: acknowledgeAsset,
    requestAsset: requestAsset, decideAssetRequest: decideAssetRequest, returnAsset: returnAsset,
    /* Payroll */
    createSalaryStructure: createSalaryStructure, initiatePayroll: initiatePayroll,
    reviewPayroll: reviewPayroll, finalizePayroll: finalizePayroll, generatePayslips: generatePayslips,
    submitTaxDeclaration: submitTaxDeclaration,
    /* Performance */
    createAppraisalCycle: createAppraisalCycle, launchAppraisalCycle: launchAppraisalCycle,
    createGoal: createGoal, updateGoalProgress: updateGoalProgress,
    submitSelfAssessment: submitSelfAssessment, submitManagerReview: submitManagerReview,
    publishResults: publishResults,
    /* Engagement */
    createSurvey: createSurvey, submitSurvey: submitSurvey, giveRecognition: giveRecognition,
    submitFeedback: submitFeedback, createActionPlan: createActionPlan,
    /* Announcements */
    canPostAnnouncements: canPostAnnouncements, postAnnouncement: postAnnouncement,
    toggleAnnouncementReaction: toggleAnnouncementReaction, commentOnAnnouncement: commentOnAnnouncement,
    /* Onboarding & offboarding */
    initiateOnboarding: initiateOnboarding, completeOnboardingTask: completeOnboardingTask,
    submitResignation: submitResignation, decideResignation: decideResignation,
    completeOffboardingTask: completeOffboardingTask, recordSettlement: recordSettlement,
    completeOffboarding: completeOffboarding,
    /* Approvals & session */
    decideApproval: decideApproval,
    switchRole: switchRole
  };
})();
