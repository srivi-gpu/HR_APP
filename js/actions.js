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

  /* ---------- telling people ----------
     One way to raise a notification, so anything the app does for a person reaches
     them. `to` is an employee id for a personal note, or a list of roles for a
     workspace-wide one; both can be given. The store surfaces these alongside the
     seeded ones, so they land in the bell and in the notification centre. */
  function notify(spec) {
    return store.add('notifications', {
      id: store.nextId('notifications', 'n'),
      kind: spec.kind,
      title: spec.title,
      body: spec.body || '',
      on: new Date().toISOString().slice(0, 16),
      read: false,
      route: spec.route || 'global/notifications',
      roles: spec.roles || ['me'],
      employee: spec.to || null
    });
  }
  function notifyEach(ids, make) {
    (ids || []).forEach(function (id) {
      var e = store.employee(id);
      if (e) notify(Object.assign({ to: id }, make(e)));
    });
    return (ids || []).length;
  }

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
  /* ------------------------------------------------- Employee numbering (PRD 3.2)

     The employee ID was a field somebody typed, with a uniqueness rule to catch them
     when they got it wrong. It is a series — the organisation's numbering record holds
     the prefix, the width and the next number — so it is generated, and the rule is
     left in place for the imports and the seeded records that still carry their own.

     Generated from the records rather than only from `next`, so a number can never be
     handed out twice: a prototype that has created employees in this browser has moved
     past whatever the seed said was next. */
  function nextEmployeeId() {
    var series = store.collection('numbering')[0]
      || { prefix: 'NEX', width: 4, next: 1 };
    var used = store.collection('employees').reduce(function (max, e) {
      var m = String(e.id || '').match(new RegExp('^' + series.prefix + '(\\d+)$'));
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    var n = Math.max(used + 1, series.next || 1);
    return series.prefix + String(n).padStart(series.width || 4, '0');
  }

  /* The work email a joiner would get, from their name and the organisation's domain.
     IT can change it before issuing — this is a proposal, not a decision. */
  function proposeWorkEmail(name) {
    var domain = (seed.org && seed.org.domain)
      || ((store.collection('employees')[0] || {}).workEmail || '@nexoratech.com').split('@')[1];
    var local = String(name || '').toLowerCase()
      .normalize ? String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      : String(name || '').toLowerCase();
    local = local.replace(/[^a-z\s]/g, '').trim().split(/\s+/).slice(0, 2).join('.');
    return local ? local + '@' + domain : '';
  }

  function createEmployee(form) {
    /* The ID comes from the series, not from the form. A work email is not asked for
       either: IT issues it, with the ID, once onboarding opens — so a joiner being
       added here has no account and no mailbox yet, which is the true state. */
    form = Object.assign({}, form, { id: form.id || nextEmployeeId() });
    var errors = rules.required([
      { key: 'firstName', label: 'First name' }, { key: 'lastName', label: 'Last name' },
      { key: 'department', label: 'Department' }, { key: 'designation', label: 'Designation' },
      { key: 'type', label: 'Employment type' }, { key: 'location', label: 'Work location' }
    ], form);
    var dup = rules.uniqueEmployeeId(form.id);
    if (dup && !errors.id) errors.id = dup;
    if (form.workEmail) {
      var mail = rules.uniqueWorkEmail(form.workEmail);
      if (mail && !errors.workEmail) errors.workEmail = mail;
    }
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
      workEmail: form.workEmail || '', personalEmail: form.personalEmail || '', phone: form.phone || '',
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
  /* --------------------------------------------- Qualifications and experience
     A person's own education record, which they keep themselves. It is not pay or
     identity, so it saves directly rather than queueing for approval. */
  function saveEducationEntry(kind, employeeId, entry) {
    if (kind !== 'qualifications' && kind !== 'experience') return fail({ _: 'Unknown record type' });
    var errors = kind === 'qualifications'
      ? rules.required([{ key: 'level', label: 'Qualification' }, { key: 'institution', label: 'Institution' }], entry)
      : rules.required([{ key: 'role', label: 'Role' }, { key: 'company', label: 'Company' }], entry);
    if (rules.hasErrors(errors)) return fail(errors);
    if (entry.id) {
      store.setOverride(kind, entry.id, entry);
      store.log('updated an education record', 'User activity');
      return done('Saved');
    }
    var id = (kind === 'qualifications' ? 'QL-' : 'EX-') + employeeId + '-' + Date.now().toString(36);
    store.add(kind, Object.assign({ id: id, employee: employeeId }, entry));
    store.log('added an education record', 'User activity');
    return done('Added');
  }
  function deleteEducationEntry(kind, id) {
    if (kind !== 'qualifications' && kind !== 'experience') return fail({ _: 'Unknown record type' });
    if (!store.find(kind, id)) return fail({ _: 'That record no longer exists' });
    store.remove(kind, id);
    store.log('removed an education record', 'User activity');
    return done('Removed');
  }

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

  /* --------------------------------------- Approval workflows (PRD 6.2)
     The engine's configuration, built from the screen rather than written into the
     source: a trigger, an ordered approver chain, a sequence, an escalation and a
     rejection behaviour. A chain with no levels is refused — a workflow that asks
     nobody would approve every request the moment it was raised. */
  function cleanStages(stages) {
    return (stages || [])
      .filter(function (st) { return st && st.type && String(st.label || '').trim(); })
      .map(function (st) { return { type: st.type, label: String(st.label).trim() }; });
  }

  function validWorkflow(form, stages) {
    var errors = rules.required([
      { key: 'name', label: 'Workflow name' },
      { key: 'module', label: 'Module' },
      { key: 'trigger', label: 'Trigger' }
    ], form);
    if (!stages.length) errors.stages = 'Add at least one approval level';
    if (form.sequence === 'Single' && stages.length > 1) {
      errors.sequence = 'A single-level workflow can only have one approver level';
    }
    var days = Number(form.escalate);
    if (form.escalate !== '' && form.escalate !== undefined && (isNaN(days) || days < 0 || days > 60)) {
      errors.escalate = 'Escalation is a number of days between 0 and 60';
    }
    return errors;
  }

  function workflowFields(form, stages) {
    return {
      name: String(form.name).trim(), module: form.module,
      trigger: String(form.trigger).trim(), stages: stages,
      sequence: form.sequence || 'Sequential',
      escalate: Number(form.escalate) || 0,
      escalateTo: form.escalateTo || 'Department head',
      reject: form.reject || 'Returned to the requester with a reason',
      status: form.status || 'Active',
      note: form.note || ''
    };
  }

  function createApprovalWorkflow(form) {
    var stages = cleanStages(form.stages);
    var errors = validWorkflow(form, stages);
    var dup = rules.uniqueIn('approvalWorkflows', 'name', form.name, null, form.name);
    if (dup && !errors.name) errors.name = dup;
    if (rules.hasErrors(errors)) return fail(errors);
    var record = Object.assign({ id: store.nextId('approvalWorkflows', 'wf-') }, workflowFields(form, stages));
    store.add('approvalWorkflows', record);
    store.log('created the approval workflow "' + record.name + '"', 'Configuration');
    return done(record.name + ' created', { id: record.id });
  }

  function updateApprovalWorkflow(id, form) {
    var row = store.find('approvalWorkflows', id);
    if (!row) return fail({ _: 'That workflow no longer exists' });
    var stages = cleanStages(form.stages);
    var errors = validWorkflow(form, stages);
    var dup = rules.uniqueIn('approvalWorkflows', 'name', form.name, id, form.name);
    if (dup && !errors.name) errors.name = dup;
    if (rules.hasErrors(errors)) return fail(errors);
    store.setOverride('approvalWorkflows', id, workflowFields(form, stages));
    store.log('updated the approval workflow "' + String(form.name).trim() + '"', 'Configuration');
    return done(String(form.name).trim() + ' updated');
  }

  function deleteApprovalWorkflow(id) {
    var row = store.find('approvalWorkflows', id);
    if (!row) return fail({ _: 'That workflow no longer exists' });
    store.remove('approvalWorkflows', id);
    store.log('deleted the approval workflow "' + row.name + '"', 'Configuration');
    return done(row.name + ' deleted');
  }

  /* ---------------------------------------------- Employee setup (PRD 3.3)
     Employee types and the status machine are configuration, so they are created,
     edited and deleted like any other record rather than being constants in a file.
     Both guard against pulling the ground out from under live data: a type still on
     somebody's record cannot be deleted, and neither can a status somebody holds. */
  function employeeTypeInUse(name) {
    return store.collection('employees').filter(function (e) { return e.type === name; }).length;
  }

  function createEmployeeType(form) {
    var errors = rules.required([{ key: 'name', label: 'Type name' }, { key: 'code', label: 'Code' }], form);
    var dup = rules.uniqueIn('employeeTypes', 'name', form.name, null, form.name);
    if (dup && !errors.name) errors.name = dup;
    var dupCode = rules.uniqueIn('employeeTypes', 'code', String(form.code || '').toUpperCase(), null, 'Code ' + form.code);
    if (dupCode && !errors.code) errors.code = dupCode;
    if (rules.hasErrors(errors)) return fail(errors);
    var name = String(form.name).trim();
    store.add('employeeTypes', {
      id: store.nextId('employeeTypes', 'et-'), name: name,
      code: String(form.code).trim().toUpperCase(),
      probation: Number(form.probation) || 0,
      leavePolicy: form.leavePolicy || null,
      status: form.status || 'Active',
      description: form.description || ''
    });
    store.log('added the employee type "' + name + '"', 'Configuration');
    return done(name + ' added');
  }

  function updateEmployeeType(id, form) {
    var row = store.find('employeeTypes', id);
    if (!row) return fail({ _: 'That employee type no longer exists' });
    var errors = rules.required([{ key: 'name', label: 'Type name' }, { key: 'code', label: 'Code' }], form);
    var dup = rules.uniqueIn('employeeTypes', 'name', form.name, id, form.name);
    if (dup && !errors.name) errors.name = dup;
    var dupCode = rules.uniqueIn('employeeTypes', 'code', String(form.code || '').toUpperCase(), id, 'Code ' + form.code);
    if (dupCode && !errors.code) errors.code = dupCode;
    if (rules.hasErrors(errors)) return fail(errors);
    var name = String(form.name).trim();
    /* Employees carry the type by name, so a rename has to move them with it or they
       would be left pointing at a type that no longer exists. */
    if (name !== row.name) {
      store.collection('employees').filter(function (e) { return e.type === row.name; })
        .forEach(function (e) { store.setOverride('employees', e.id, { type: name }); });
    }
    store.setOverride('employeeTypes', id, {
      name: name, code: String(form.code).trim().toUpperCase(),
      probation: Number(form.probation) || 0,
      leavePolicy: form.leavePolicy || null,
      status: form.status || 'Active',
      description: form.description || ''
    });
    store.log('updated the employee type "' + name + '"', 'Configuration');
    return done(name + ' updated');
  }

  function deleteEmployeeType(id) {
    var row = store.find('employeeTypes', id);
    if (!row) return fail({ _: 'That employee type no longer exists' });
    var used = employeeTypeInUse(row.name);
    if (used) return fail({ _: row.name + ' is on ' + used + ' employee record' + (used === 1 ? '' : 's') + ', so it cannot be deleted' });
    store.remove('employeeTypes', id);
    store.log('deleted the employee type "' + row.name + '"', 'Configuration');
    return done(row.name + ' deleted');
  }

  function statusInUse(name) {
    return store.collection('employees').filter(function (e) { return e.status === name; }).length;
  }

  function createEmployeeStatus(form) {
    var errors = rules.required([{ key: 'status', label: 'Status name' }], form);
    var dup = rules.uniqueIn('statusTransitions', 'status', form.status, null, form.status);
    if (dup && !errors.status) errors.status = dup;
    if (rules.hasErrors(errors)) return fail(errors);
    var name = String(form.status).trim();
    store.add('statusTransitions', {
      id: store.nextId('statusTransitions', 'st-'), status: name,
      to: form.to || [], note: form.note || ''
    });
    store.log('added the employee status "' + name + '"', 'Configuration');
    return done(name + ' added');
  }

  function updateEmployeeStatus(id, form) {
    var row = store.find('statusTransitions', id);
    if (!row) return fail({ _: 'That status no longer exists' });
    var errors = rules.required([{ key: 'status', label: 'Status name' }], form);
    var dup = rules.uniqueIn('statusTransitions', 'status', form.status, id, form.status);
    if (dup && !errors.status) errors.status = dup;
    if (rules.hasErrors(errors)) return fail(errors);
    var name = String(form.status).trim();
    var to = (form.to || []).filter(function (t) { return t !== name; });
    if (name !== row.status) {
      /* Rename the status everywhere it is referenced: on employee records, and in
         every other row's target list, or those targets would dangle. */
      store.collection('employees').filter(function (e) { return e.status === row.status; })
        .forEach(function (e) { store.setOverride('employees', e.id, { status: name }); });
      store.collection('statusTransitions').forEach(function (other) {
        if (other.id === id || (other.to || []).indexOf(row.status) < 0) return;
        store.setOverride('statusTransitions', other.id, {
          to: other.to.map(function (t) { return t === row.status ? name : t; })
        });
      });
    }
    store.setOverride('statusTransitions', id, { status: name, to: to, note: form.note || '' });
    store.log('updated the employee status "' + name + '"', 'Configuration');
    return done(name + ' updated');
  }

  function deleteEmployeeStatus(id) {
    var row = store.find('statusTransitions', id);
    if (!row) return fail({ _: 'That status no longer exists' });
    var used = statusInUse(row.status);
    if (used) return fail({ _: row.status + ' is on ' + used + ' employee record' + (used === 1 ? '' : 's') + ', so it cannot be deleted' });
    /* Nothing may still point at it, or the Change status dialog would offer a
       status that has no row of its own. */
    store.collection('statusTransitions').forEach(function (other) {
      if (other.id === id || (other.to || []).indexOf(row.status) < 0) return;
      store.setOverride('statusTransitions', other.id, {
        to: other.to.filter(function (t) { return t !== row.status; })
      });
    });
    store.remove('statusTransitions', id);
    store.log('deleted the employee status "' + row.status + '"', 'Configuration');
    return done(row.status + ' deleted');
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
    var pct = form.carry ? Number(form.carryPct) : 0;
    if (form.carry && (isNaN(pct) || pct <= 0 || pct > 100)) {
      errors.carryPct = 'Carry forward is a percentage between 1 and 100';
    }
    if (rules.hasErrors(errors)) return fail(errors);
    store.add('leaveTypes', {
      id: 'lt-' + form.code.toLowerCase(), code: form.code.toUpperCase(), name: form.name,
      paid: form.paid !== false, annual: Number(form.annual) || 0, carry: !!form.carry,
      /* How much of an unused balance moves into the next year, as a percentage.
         Nil when nothing carries, so the two fields cannot disagree. */
      carryPct: form.carry ? pct : 0,
      maxAccrual: Number(form.maxAccrual) || 0, maxConsecutive: Number(form.maxConsecutive) || 0,
      notice: Number(form.notice) || 0, docRequired: !!form.docRequired,
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
  /* Changing a request nobody has decided yet. Once it is approved the dates are
     somebody else's plan too, so an approved request can only be cancelled. The balance
     is untouched: a pending request never took days out of it. */
  function updateLeaveRequest(id, form) {
    var req = store.find('leaveRequests', id);
    if (!req) return fail({ _: 'That request no longer exists' });
    if (!/pending/i.test(req.status)) return fail({ _: 'Only a request still awaiting a decision can be changed' });
    var employee = store.employee(req.employee);
    if (!employee) return fail({ _: 'Employee not found' });
    /* `id` is excluded from the overlap check: a request does not clash with itself. */
    var errors = rules.validateLeave({
      type: req.type, from: form.from, to: form.to, reason: form.reason, halfDay: req.halfDay
    }, employee, id);
    if (rules.hasErrors(errors)) return fail(errors);
    var days = rules.countLeaveDays(form.from, form.to, req.halfDay).total;
    store.setOverride('leaveRequests', id, {
      from: form.from, to: form.to,
      fromLabel: pretty(new Date(form.from + 'T00:00')),
      toLabel: pretty(new Date(form.to + 'T00:00')),
      days: days, reason: form.reason || req.reason
    });
    store.log('updated leave request ' + id, 'User activity');
    return done('Request ' + id + ' updated to ' + days + ' day' + (days === 1 ? '' : 's'));
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

  /* The shift an employee is *on*, as opposed to the dated roster rows assignShift
     writes. Changing it in bulk is what moving a team onto a new shift actually means:
     the roster governs a given week, this governs what they are rostered to by default.
     Each change is recorded against the employee like any other record edit. */
  function changeDefaultShift(employeeIds, shiftId) {
    var ids = [].concat(employeeIds);
    if (!ids.length) return fail({ _: 'Choose at least one employee' });
    var shift = store.shift(shiftId);
    if (!shift) return fail({ shift: 'Choose a shift' });
    var changed = 0, already = 0;
    ids.forEach(function (employeeId) {
      var e = store.employee(employeeId);
      if (!e) return;
      if (e.shift === shiftId) { already++; return; }
      store.setOverride('employees', employeeId, { shift: shiftId });
      store.add('employmentHistory', {
        id: store.nextId('employmentHistory', 'EH'), employee: employeeId, on: today(),
        change: 'Assigned shift changed',
        from: (store.shift(e.shift) || {}).name || '—', to: shift.name
      });
      changed++;
    });
    store.log('moved ' + changed + ' employee(s) onto the ' + shift.name + ' shift', 'User activity');
    if (!changed) return done('Everyone selected is already on ' + shift.name, { changed: 0, already: already });
    return done(changed + ' employee' + (changed === 1 ? '' : 's') + ' moved onto ' + shift.name
      + (already ? ', ' + already + ' already on it' : ''), { changed: changed, already: already });
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
  /* `title` is what the person calls the document; `name` is the file it came from.
     A row of filenames says very little, so the two are kept apart and the title is
     what every list leads with. */
  function uploadDocument(employeeId, form) {
    var errors = rules.required([
      { key: 'title', label: 'Document name' },
      { key: 'category', label: 'Category' },
      { key: 'name', label: 'File' }
    ], form);
    if (rules.hasErrors(errors)) return fail(errors);
    var title = String(form.title).trim();
    var id = store.nextId('employeeDocuments', 'DOC');
    store.add('employeeDocuments', {
      id: id, employee: employeeId, title: title, category: form.category, name: form.name,
      uploaded: today(), status: 'Pending Verification', verifiedBy: null,
      expiry: form.expiry || null, size: form.size || '— KB'
    });
    store.log('uploaded "' + title + '"', 'User activity');
    return done(title + ' uploaded and sent for verification', { id: id });
  }
  /* The name is the one thing the owner may change after upload: the file and its
     verification are the record, the label is theirs. */
  function renameEmployeeDocument(id, title) {
    var doc = store.find('employeeDocuments', id);
    if (!doc) return fail({ _: 'That document no longer exists' });
    var clean = String(title || '').trim();
    if (!clean) return fail({ title: 'Give the document a name' });
    store.setOverride('employeeDocuments', id, { title: clean });
    store.log('renamed a document to "' + clean + '"', 'User activity');
    return done('Renamed to ' + clean);
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

  /* ------------------------------------------------------------ Holiday calendar
     PRD 4.11. `locs` is 'all' or a list of location ids; `type` carries Optional,
     which is what leave counting keys off (PRD 14.2). */
  function holidayType(optional) { return optional ? 'Optional' : 'Public'; }

  function addHoliday(form) {
    var errors = rules.validHoliday(form);
    if (rules.hasErrors(errors)) return fail(errors);
    var id = store.nextId('holidays', 'hol-');
    var name = String(form.name).trim();
    store.add('holidays', {
      id: id, date: form.date, name: name,
      type: form.type || holidayType(form.optional),
      locs: form.locs || 'all'
    });
    store.log('added the holiday "' + name + '" on ' + form.date, 'Configuration');
    return done(name + ' added to the calendar', { id: id });
  }
  function updateHoliday(id, form) {
    var hd = store.find('holidays', id);
    if (!hd) return fail({ _: 'That holiday no longer exists' });
    var errors = rules.validHoliday(form, id);
    if (rules.hasErrors(errors)) return fail(errors);
    var name = String(form.name).trim();
    store.setOverride('holidays', id, {
      date: form.date, name: name,
      type: form.type || holidayType(form.optional),
      locs: form.locs || 'all'
    });
    store.log('updated the holiday "' + name + '"', 'Configuration');
    return done(name + ' updated');
  }
  function deleteHoliday(id) {
    var hd = store.find('holidays', id);
    if (!hd) return fail({ _: 'That holiday no longer exists' });
    store.remove('holidays', id);
    store.log('deleted the holiday "' + hd.name + '"', 'Configuration');
    return done(hd.name + ' removed from the calendar');
  }
  /* Bulk add from an imported sheet. Rows that fail validation are reported rather
     than dropped silently, so a bad spreadsheet is visible instead of half-applied. */
  function importHolidays(rows) {
    var added = [], skipped = [];
    [].concat(rows || []).forEach(function (row, i) {
      var candidate = {
        name: row.name, date: row.date,
        type: row.type || holidayType(row.optional),
        locs: row.locs || 'all'
      };
      var errors = rules.validHoliday(candidate);
      if (rules.hasErrors(errors)) {
        skipped.push({ row: i + 1, name: row.name || '(no name)', why: errors.name || errors.date });
        return;
      }
      var id = store.nextId('holidays', 'hol-');
      store.add('holidays', {
        id: id, date: candidate.date, name: String(candidate.name).trim(),
        type: candidate.type, locs: candidate.locs
      });
      added.push(id);
    });
    store.log('imported ' + added.length + ' holiday(s)', 'Configuration');
    if (!added.length) {
      return fail({ _: 'Nothing imported — every row was rejected' + (skipped.length ? ': ' + skipped[0].why : '') });
    }
    return done(added.length + ' holiday' + (added.length === 1 ? '' : 's') + ' imported'
      + (skipped.length ? ', ' + skipped.length + ' skipped' : ''),
      { added: added.length, skipped: skipped });
  }

  /* ------------------------------------------- Company library (documents & folders)
     Renaming and deleting are HR's, so the library can be kept tidy rather than only
     added to. A delete is a tombstone in the store, so a seeded row goes too. */
  function renameDocument(id, name) {
    var doc = store.find('policies', id);
    if (!doc) return fail({ _: 'That document no longer exists' });
    var clean = String(name || '').trim();
    if (!clean) return fail({ name: 'Give the document a name' });
    if (clean === doc.name) return done('Name unchanged');
    var clash = store.collection('policies').filter(function (d) {
      return d.id !== id && (d.folder || null) === (doc.folder || null)
        && d.name.toLowerCase() === clean.toLowerCase();
    })[0];
    if (clash) return fail({ name: 'Another document in this folder already has that name' });
    store.setOverride('policies', id, { name: clean });
    store.log('renamed "' + doc.name + '" to "' + clean + '"', 'User activity');
    return done('Renamed to ' + clean);
  }
  function deleteDocument(id) {
    var doc = store.find('policies', id);
    if (!doc) return fail({ _: 'That document no longer exists' });
    store.remove('policies', id);
    store.log('deleted the document "' + doc.name + '"', 'User activity');
    return done(doc.name + ' deleted');
  }
  function renameFolder(id, name) {
    var folder = store.find('docFolders', id);
    if (!folder) return fail({ _: 'That folder no longer exists' });
    var clean = String(name || '').trim();
    if (!clean) return fail({ name: 'Give the folder a name' });
    if (clean === folder.name) return done('Name unchanged');
    var clash = store.collection('docFolders').filter(function (f) {
      return f.id !== id && (f.parent || null) === (folder.parent || null)
        && f.name.toLowerCase() === clean.toLowerCase();
    })[0];
    if (clash) return fail({ name: 'A folder with that name is already here' });
    store.setOverride('docFolders', id, { name: clean });
    store.log('renamed the folder "' + folder.name + '" to "' + clean + '"', 'User activity');
    return done('Renamed to ' + clean);
  }
  /* Everything inside goes with it, which is why the dialog counts it first. */
  function deleteFolder(id) {
    var folder = store.find('docFolders', id);
    if (!folder) return fail({ _: 'That folder no longer exists' });
    var all = store.collection('docFolders');
    var ids = [];
    (function walk(fid) {
      ids.push(fid);
      all.filter(function (f) { return (f.parent || null) === fid; })
        .forEach(function (f) { walk(f.id); });
    })(id);
    var docs = store.collection('policies').filter(function (d) { return ids.indexOf(d.folder) >= 0; });
    docs.forEach(function (d) { store.remove('policies', d.id); });
    ids.forEach(function (fid) { store.remove('docFolders', fid); });
    store.log('deleted the folder "' + folder.name + '" with ' + docs.length + ' document(s)', 'User activity');
    return done(folder.name + ' deleted'
      + (docs.length ? ', with ' + docs.length + ' document' + (docs.length === 1 ? '' : 's') : ''));
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



  /* ---------- raising an asset request ----------
     Requests used to arrive only from Tracklivo. People can now raise one from inside
     the asset portal: an employee asking for a new unit or reporting a fault on one
     they hold, and HR asking for a joiner's kit before their first day. The decision
     is still Tracklivo's — nothing here approves anything — so a request raised here
     goes out in the same state a Tracklivo one arrives in, marked with where it came
     from, and IT is told it is waiting. */
  var ASSET_REQUEST_KINDS = {
    'New asset': { needs: ['category', 'reason'], for: 'self' },
    'Repair': { needs: ['asset', 'reason'], for: 'self' },
    'Onboarding': { needs: ['employee', 'category', 'reason'], for: 'other' }
  };

  function raiseAssetRequest(raisedBy, form) {
    var kind = form.kind || 'New asset';
    var spec = ASSET_REQUEST_KINDS[kind];
    if (!spec) return fail({ _: 'Pick what the request is for' });

    var need = [];
    if (spec.needs.indexOf('employee') > -1) need.push({ key: 'employee', label: 'Who it is for' });
    if (spec.needs.indexOf('category') > -1) need.push({ key: 'category', label: 'Asset category' });
    if (spec.needs.indexOf('asset') > -1) need.push({ key: 'asset', label: 'Which asset' });
    need.push({ key: 'reason', label: kind === 'Repair' ? 'What is wrong' : 'Reason' });
    var errors = rules.required(need, form);
    if (rules.hasErrors(errors)) return fail(errors);

    var forWhom = kind === 'Onboarding' ? form.employee : raisedBy;
    var category = form.category;
    if (kind === 'Repair') {
      var unit = store.find('assets', form.asset);
      if (!unit) return fail({ asset: 'That asset is no longer on the register' });
      category = unit.category;
    }

    var id = store.nextId('assetRequests', 'AR');
    store.add('assetRequests', {
      id: id, employee: forWhom, category: category,
      reason: form.reason, status: 'Pending Approval', requestedOn: today(),
      kind: kind, source: 'Portal', raisedBy: raisedBy,
      asset: kind === 'Repair' ? form.asset : null,
      neededBy: form.neededBy || null
    });

    var who = store.employee(forWhom), by = store.employee(raisedBy);
    var label = kind === 'Repair' ? 'Repair' : kind === 'Onboarding' ? 'Onboarding kit' : category;

    /* IT picks these up on the register. */
    notify({
      kind: 'Asset Request', roles: ['admin'], route: 'admin/assets/requests',
      title: label + ' requested for ' + (who ? who.name : forWhom),
      body: (by ? by.name : 'Someone') + ' raised ' + id + ' · ' + form.reason
    });
    /* And the person it is for knows it is moving, even when HR raised it. */
    if (forWhom !== raisedBy) {
      notify({
        to: forWhom, kind: 'Asset Request', roles: ['me'], route: 'me/assets/requests',
        title: label + ' requested for you',
        body: (by ? by.name : 'HR') + ' raised ' + id + '. You will be told when it is ready to collect.'
      });
    }
    store.log('raised asset request ' + id + ' (' + kind.toLowerCase() + ') for ' +
      (who ? who.name : forWhom), 'User activity');

    return done(kind === 'Repair' ? 'Repair raised · ' + id : 'Request ' + id + ' raised', { id: id });
  }

  /* ---------- Ara on asset requests ----------

     Every request used to wait for a person, and most of them did not need one. An
     access card is nine hundred rupees and the store has forty of them; a card that
     snapped in a lanyard is a like-for-like swap for something the person already
     carries. Nobody learns anything by approving those by hand, and while they sit
     in a queue the person cannot get into the building.

     So Ara decides those two, and only those two:

       1. a repair or replacement of a unit the person already holds — the
          entitlement is not in question, only the unit is;
       2. standard kit — a category whose dearest unit on the register is at or under
          the cap, so the worst a wrong call costs is one cheap item.

     Everything else is a person's: a first laptop, a phone, a second monitor, any
     category the cap does not cover. The cap is read against the register rather
     than written as a list of categories, so a category somebody adds next year is
     judged by what it costs, not by whether anyone remembered to add it here.

     Ara never issues. It decides, and it reserves a unit where the store has one
     free, so that the only thing left is a person handing the thing over. Issuing
     moves an asset onto somebody's name and off the shelf, and that stays with IT. */
  var ARA_ASSET_CAP = 15000;

  function dearestOf(category) {
    return store.collection('assets').reduce(function (n, a) {
      return a.category === category ? Math.max(n, a.value || 0) : n;
    }, 0);
  }

  /* Why, in the words the screen shows. A verdict always carries one, whichever way
     it goes: "Ara approved it" with no reason is not a decision anybody can audit. */
  function araAssetVerdict(req) {
    if (!req || req.status !== 'Pending Approval') {
      return { approve: false, why: 'Already decided.' };
    }
    var held = req.asset && store.find('assets', req.asset);
    if (req.kind === 'Repair' && held && held.assignedTo === req.employee) {
      return { approve: true, rule: 'replacement',
        why: 'A like-for-like replacement of the ' + held.category.toLowerCase()
          + ' ' + nameOf(req.employee) + ' already holds. The entitlement is not in question.' };
    }
    var dearest = dearestOf(req.category);
    if (dearest && dearest <= ARA_ASSET_CAP) {
      return { approve: true, rule: 'standard',
        why: 'Standard kit: the dearest ' + req.category.toLowerCase() + ' on the register is '
          + HRMS.ui.inr(dearest) + ', inside the ' + HRMS.ui.inr(ARA_ASSET_CAP) + ' cap.' };
    }
    return { approve: false, rule: 'person',
      why: dearest
        ? 'A ' + req.category.toLowerCase() + ' runs to ' + HRMS.ui.inr(dearest)
          + ', over the ' + HRMS.ui.inr(ARA_ASSET_CAP) + ' cap, and this is not a replacement.'
        : 'Nothing of this category is on the register yet, so there is nothing to judge it against.' };
  }

  /* The first free unit of the category, so an approved request names the thing it
     will be met with. Reserving is not issuing: the unit stays Available and on the
     shelf until somebody in IT hands it over. */
  /* Available and not already promised. Two requests for the same category, or a
     request and a joiner's kit, were both handed the first free unit of it: the
     register said one thing was set aside for two people, and whoever was issued
     second took a unit the other had been told was theirs. */
  function spokenFor() {
    var taken = {};
    store.collection('assetRequests').forEach(function (r) {
      if (r.reserved && r.status === 'Approved') taken[r.reserved] = true;
    });
    return taken;
  }

  function freeUnitFor(category, skip) {
    var taken = skip || spokenFor();
    return store.collection('assets').filter(function (a) {
      return a.category === category && a.status === 'Available' && !taken[a.id];
    })[0] || null;
  }

  function decideAssetRequest(id, approve, by, why) {
    var req = store.find('assetRequests', id);
    if (!req) return fail({ _: 'That request no longer exists' });
    if (req.status !== 'Pending Approval') return fail({ _: 'That request has already been decided' });

    var unit = approve ? freeUnitFor(req.category) : null;
    store.setOverride('assetRequests', id, {
      status: approve ? 'Approved' : 'Rejected',
      decidedBy: by || 'Ara', decidedOn: today(),
      decidedWhy: why || null,
      reserved: unit ? unit.id : null
    });

    var who = store.employee(req.employee);
    notify({
      to: req.employee, kind: 'Asset Request', roles: ['me'], route: 'me/assets/requests',
      title: req.category + ' request ' + (approve ? 'approved' : 'declined'),
      body: approve
        ? (unit ? unit.name + ' is set aside for you. IT will hand it over.'
          : 'Approved. IT will issue one as soon as a unit is free.')
        : (why || 'Declined.')
    });
    store.log((by === 'Ara' ? 'Ara ' : '') + (approve ? 'approved' : 'declined') + ' asset request ' + id
      + ' for ' + (who ? who.name : req.employee), by === 'Ara' ? 'Automation' : 'User activity');
    return done('Request ' + id + ' ' + (approve ? 'approved' : 'declined'), { reserved: unit });
  }

  /* ---------- Ara on a joiner's kit ----------
     The same cap, applied the other way round. A joiner needs the standard kit on
     day one and nobody gains anything by typing out an access card and a keyboard
     for every person who starts: Ara picks a free unit of each standard category
     they do not already hold, and sets it against their name in the issue screen.

     Picking is not issuing. The units stay Available until IT presses the button,
     because a joiner's kit is handed over in a room, and the register should say
     what actually happened rather than what was planned. A laptop is never in this
     list — it is over the cap, so it is a request somebody decides. */
  function araJoinerKit(employeeId) {
    var held = {};
    store.collection('assets').forEach(function (a) {
      if (a.assignedTo === employeeId) held[a.category] = true;
    });
    var taken = spokenFor();
    var seen = {}, out = [];
    store.collection('assets').forEach(function (a) {
      if (a.status !== 'Available' || held[a.category] || seen[a.category] || taken[a.id]) return;
      if (dearestOf(a.category) > ARA_ASSET_CAP) return;
      seen[a.category] = true;
      out.push({ category: a.category, unit: a });
    });
    return out.sort(function (x, y) { return x.category < y.category ? -1 : 1; });
  }

  /* Every pending request Ara's own rule covers, decided in one pass. */
  function araAssetQueue() {
    return store.collection('assetRequests')
      .filter(function (r) { return r.status === 'Pending Approval'; })
      .map(function (r) { return { request: r, verdict: araAssetVerdict(r) }; });
  }

  function araDecideAssetRequests() {
    var mine = araAssetQueue().filter(function (x) { return x.verdict.approve; });
    /* Decided one at a time, so each row's reservation is visible to the next: a
       pass that read the register once would give two access-card requests the
       same card. */
    mine.forEach(function (x) { decideAssetRequest(x.request.id, true, 'Ara', x.verdict.why); });
    return done(mine.length
      ? 'Ara approved ' + mine.length + ' request' + (mine.length === 1 ? '' : 's')
      : 'Nothing for Ara to decide', { n: mine.length });
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
    /* The title is optional: the composer posts without one, and the card then leads
       with the body. `body` stays plain text for the dashboard, search and anything
       else that reads it; `html` carries the formatting when there is any. */
    var errors = rules.required([{ key: 'body', label: 'Announcement' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    var author = store.persona('hr');
    var id = store.nextId('announcements', 'an-');
    var title = String(form.title || '').trim();
    store.add('announcements', {
      id: id, title: title, body: form.body, html: form.html || null,
      by: author ? author.id : null, byName: author ? author.name : 'HR',
      on: today(), pinned: !!form.pinned
    });
    store.log('posted the announcement "' + (title || form.body.slice(0, 40)) + '"', 'User activity');
    return done('Announcement posted', { id: id });
  }

  /* A reaction is one row per person per emoji, so this adds or removes rather than
     counting up and down. Reacting twice with the same emoji takes it back. */
  /* Pinning, editing and withdrawing are the poster's, which here means HR's. An
     employee reads an announcement and reacts to it; they do not change one. */
  function pinAnnouncement(id, pinned) {
    if (!canPostAnnouncements()) return fail({ _: 'Only HR can pin an announcement' });
    var a = store.find('announcements', id);
    if (!a) return fail({ _: 'That announcement no longer exists' });
    store.setOverride('announcements', id, { pinned: !!pinned });
    store.log((pinned ? 'pinned' : 'unpinned') + ' the announcement "' + (a.title || a.body.slice(0, 40)) + '"', 'User activity');
    return done(pinned ? 'Pinned to the top' : 'Unpinned');
  }
  function editAnnouncement(id, form) {
    if (!canPostAnnouncements()) return fail({ _: 'Only HR can edit an announcement' });
    var a = store.find('announcements', id);
    if (!a) return fail({ _: 'That announcement no longer exists' });
    var errors = rules.required([{ key: 'body', label: 'Announcement' }], form);
    if (rules.hasErrors(errors)) return fail(errors);
    store.setOverride('announcements', id, {
      title: String(form.title || '').trim(),
      body: form.body,
      html: form.html || null,
      editedOn: today()
    });
    store.log('edited the announcement ' + id, 'User activity');
    return done('Announcement updated');
  }
  function deleteAnnouncement(id) {
    if (!canPostAnnouncements()) return fail({ _: 'Only HR can delete an announcement' });
    var a = store.find('announcements', id);
    if (!a) return fail({ _: 'That announcement no longer exists' });
    /* The reactions and comments go too: left behind they would belong to nothing. */
    store.collection('announcementReactions')
      .filter(function (r) { return r.announcement === id; })
      .forEach(function (r) { store.remove('announcementReactions', r.id); });
    store.collection('announcementComments')
      .filter(function (c) { return c.announcement === id; })
      .forEach(function (c) { store.remove('announcementComments', c.id); });
    store.remove('announcements', id);
    store.log('deleted the announcement "' + (a.title || a.body.slice(0, 40)) + '"', 'User activity');
    return done('Announcement deleted');
  }

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
  /* `opts.joiningDate` moves the whole checklist in front of the start date: onboarding
     is pre-joining work, so the last task falls the day before the joiner arrives rather
     than a day after. Omit it and the employee's own joining date is used. */
  function initiateOnboarding(employeeId, templateId, opts) {
    opts = opts || {};
    var employee = store.employee(employeeId);
    if (!employee) return fail({ _: 'Employee not found' });
    var existing = store.collection('onboarding').filter(function (o) { return o.employee === employeeId; })[0];
    if (existing) return fail({ _: nameOf(employeeId) + ' already has an onboarding case' });

    var joining = opts.joiningDate || employee.joined;
    var errors = rules.validOnboardingStart({ joiningDate: joining, template: templateId });
    if (rules.hasErrors(errors)) return fail(errors);

    var joinDate = new Date(joining + 'T00:00');
    var names = seed.onboardingTaskNames;
    var hr = (store.persona('hr') || {}).id;
    var it = (store.employeeByName('Sandeep Rao') || {}).id;
    var id = store.nextId('onboarding', 'ONB');
    var total = names.length;
    store.add('onboarding', {
      id: id, employee: employeeId, template: templateId || 'tpl-standard',
      startDate: joining, startDateLabel: pretty(joinDate),
      source: employee.source || 'Direct',
      invitedOn: today(),
      tasksTotal: total, tasksDone: 0, pending: total, overdue: 0,
      stage: 'Yet to Start',
      tasks: names.map(function (t, i) {
        return {
          name: t, done: false,
          assignee: /IT|Asset/.test(t) ? it : /Manager|Department/.test(t) ? employee.manager : hr,
          /* Counted back from the joining date: the last task is due the day before. */
          due: iso(addDays(joinDate, -(total - i))),
          mandatory: i < 8
        };
      })
    });

    /* The invitation itself. The prototype has no mail transport, so it is recorded as a
       notification to the joiner and in the audit trail rather than silently claimed. */
    var to = employee.personalEmail || employee.workEmail;
    store.add('notifications', {
      id: store.nextId('notifications', 'n'),
      kind: 'Onboarding Invitation',
      title: 'Your onboarding for ' + pretty(joinDate) + ' is open',
      body: total + ' tasks to complete before you join · first due ' + pretty(addDays(joinDate, -total)),
      on: new Date().toISOString().slice(0, 16), read: false,
      route: 'me/documents', roles: ['me'], employee: employeeId
    });
    store.log('started onboarding for ' + employee.name + ' and emailed ' + to, 'User activity');

    return done('Onboarding started for ' + employee.name + ' · invitation emailed to ' + to,
      { id: id, mailedTo: to });
  }

  /* ----------------------------------------------- The IT half of a joiner

     Starting an onboarding raises work for IT, and until this existed that work was a
     checkbox on HR's list called "IT setup" with nothing behind it. A joiner cannot
     sign in until somebody creates their account, and nobody could.

     `joinerQueue` is derived rather than stored: an onboarding case whose IT setup task
     is still open is waiting on IT, and that is the only fact involved. A second
     collection would have been a second place for it to be wrong.

     Issuing does the four things that were only ever described: it gives the joiner
     their work email, creates the account they will sign in with, closes the IT task on
     HR's checklist, and sends the credentials to the personal address — because the
     work address is the thing being created and cannot carry its own announcement. */
  function joinerQueue() {
    return store.collection('onboarding').filter(function (c) {
      if (c.stage === 'Completed') return false;
      var it = (c.tasks || []).filter(function (t) { return t.name === 'IT setup'; })[0];
      return it && !it.done;
    }).map(function (c) {
      var e = store.employee(c.employee) || {};
      return {
        id: c.id, employee: c.employee, name: e.name || c.employee,
        personalEmail: e.personalEmail || '',
        department: e.department, designation: e.designation,
        startDate: c.startDate, startDateLabel: c.startDateLabel,
        workEmail: e.workEmail || '',
        proposed: e.workEmail || proposeWorkEmail(e.name),
        hasAccount: store.collection('users').some(function (u) { return u.employee === c.employee; })
      };
    });
  }

  function issueJoinerCredentials(caseId, form) {
    var c = store.find('onboarding', caseId);
    if (!c) return fail({ _: 'That onboarding case no longer exists' });
    var e = store.employee(c.employee);
    if (!e) return fail({ _: 'That employee record no longer exists' });

    var email = String(form && form.workEmail || '').trim();
    var errors = {};
    if (!email) errors.workEmail = 'Required';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.workEmail = 'That is not an email address';
    else {
      var clash = rules.uniqueWorkEmail(email, e.id);
      if (clash) errors.workEmail = clash;
    }
    if (!e.personalEmail) {
      errors._ = 'There is no personal address on ' + e.name + "'s record to send the credentials to";
    }
    if (rules.hasErrors(errors)) return fail(errors);

    store.setOverride('employees', e.id, { workEmail: email, credentialsIssuedOn: today() });

    /* The account they sign in with. If one already exists — a record imported with
       its user — it is pointed at the new address rather than duplicated. */
    var existing = store.collection('users').filter(function (u) { return u.employee === e.id; })[0];
    if (existing) store.setOverride('users', existing.id, { email: email, status: 'Pending Invitation' });
    else {
      store.add('users', {
        id: store.nextId('users', 'USR'), employee: e.id, email: email,
        role: form && form.role ? form.role : 'me',
        status: 'Pending Invitation', lastSignIn: null, mfa: false, invitedOn: today()
      });
    }

    completeOnboardingTask(caseId, 'IT setup', true);

    /* To the personal address, because the work one is what is being handed over. */
    notify({
      kind: 'Onboarding Invitation',
      title: 'Your sign-in details are ready',
      body: 'Employee ID ' + e.id + ' · ' + email + '. Sign in and finish your onboarding before '
        + (c.startDateLabel || 'your first day') + '.',
      route: 'me/onboarding', roles: ['me'], to: e.id
    });
    store.log('issued ' + email + ' and ' + e.id + ' to ' + e.name
      + ' and sent them to ' + e.personalEmail, 'User activity');

    /* The kit Ara set aside, handed over in the same act. Nothing was moved onto
       their name before this button: picking is Ara's, issuing is IT's. */
    var kit = (form && form.kit) || [];
    var issued = [];
    kit.forEach(function (assetId) {
      var res = allocateAsset(assetId, e.id);
      if (res && res.ok) {
        var unit = store.find('assets', assetId);
        issued.push(unit ? unit.name : assetId);
      }
    });
    if (issued.length) {
      completeOnboardingTask(caseId, 'Asset allocation', true);
      notify({
        to: e.id, kind: 'Asset Allocation', roles: ['me'], route: 'me/assets/assigned',
        title: issued.length + ' item' + (issued.length === 1 ? '' : 's') + ' issued to you',
        body: issued.join(', ') + '. Acknowledge the handover from your assets page.'
      });
      store.log('issued ' + issued.join(', ') + ' to ' + e.name + ' with their credentials', 'User activity');
    }

    return done(e.id + ' and ' + email + ' sent to ' + e.personalEmail
      + (issued.length ? ', with ' + issued.length + ' item' + (issued.length === 1 ? '' : 's') + ' issued' : ''),
      { employeeId: e.id, workEmail: email, issued: issued });
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
  /* ------------------------------------ Exit clearance checklists (PRD 4.48)
     The steps an exit has to clear, their owners and their approvers. A step with
     no name is dropped rather than refused, so a half-filled row left behind in
     the builder does not block a save; a checklist with no steps at all is
     refused, because it would clear an exit the moment it opened. */
  function cleanSteps(steps) {
    return (steps || [])
      .filter(function (st) { return st && String(st.name || '').trim(); })
      .map(function (st) {
        return {
          name: String(st.name).trim(),
          owner: st.owner || 'HR Administrator',
          approver: st.approver || 'HR Administrator',
          after: Number(st.after) || 0,
          mandatory: st.mandatory !== false,
          gate: !!st.gate
        };
      });
  }

  function validChecklist(form, steps, exceptId) {
    var errors = rules.required([{ key: 'name', label: 'Checklist name' }], form);
    var dup = rules.uniqueIn('exitChecklists', 'name', form.name, exceptId || null, form.name);
    if (dup && !errors.name) errors.name = dup;
    if (!steps.length) errors.steps = 'Add at least one step';
    var seen = {};
    for (var i = 0; i < steps.length; i++) {
      var key = steps[i].name.toLowerCase();
      if (seen[key]) { errors.steps = 'Two steps are both called "' + steps[i].name + '"'; break; }
      seen[key] = true;
    }
    return errors;
  }

  function checklistFields(form, steps) {
    return {
      name: String(form.name).trim(),
      appliesTo: form.appliesTo || 'All',
      description: form.description || '',
      status: form.status || 'Active',
      steps: steps
    };
  }

  function createExitChecklist(form) {
    var steps = cleanSteps(form.steps);
    var errors = validChecklist(form, steps);
    if (rules.hasErrors(errors)) return fail(errors);
    var record = Object.assign({ id: store.nextId('exitChecklists', 'xc-') }, checklistFields(form, steps));
    store.add('exitChecklists', record);
    store.log('created the exit checklist "' + record.name + '"', 'Configuration');
    return done(record.name + ' created', { id: record.id });
  }

  function updateExitChecklist(id, form) {
    var row = store.find('exitChecklists', id);
    if (!row) return fail({ _: 'That checklist no longer exists' });
    var steps = cleanSteps(form.steps);
    var errors = validChecklist(form, steps, id);
    if (rules.hasErrors(errors)) return fail(errors);
    store.setOverride('exitChecklists', id, checklistFields(form, steps));
    store.log('updated the exit checklist "' + String(form.name).trim() + '"', 'Configuration');
    return done(String(form.name).trim() + ' updated');
  }

  function deleteExitChecklist(id) {
    var row = store.find('exitChecklists', id);
    if (!row) return fail({ _: 'That checklist no longer exists' });
    var live = store.collection('exitChecklists').filter(function (x) {
      return x.id !== id && x.status !== 'Inactive';
    });
    if (!live.length) {
      return fail({ _: 'This is the last active checklist. An exit would have nothing to clear.' });
    }
    store.remove('exitChecklists', id);
    store.log('deleted the exit checklist "' + row.name + '"', 'Configuration');
    return done(row.name + ' deleted');
  }

  /* The checklist a leaver gets: the narrowest active one that names their
     employee type, else the one that applies to everyone. */
  function checklistFor(employee) {
    var all = store.collection('exitChecklists').filter(function (c) { return c.status !== 'Inactive'; });
    return all.filter(function (c) { return c.appliesTo === (employee || {}).type; })[0]
      || all.filter(function (c) { return c.appliesTo === 'All'; })[0]
      || all[0] || null;
  }

  /* Who a step's owner resolves to. A role resolves to the person holding it; the
     reporting manager resolves to the leaver's own. HR carries anything that does
     not resolve, so no step is left with nobody against it. */
  function ownerFor(label, employee) {
    var hr = (store.persona('hr') || {}).id;
    if (label === 'Reporting Manager') return (employee && employee.manager) || hr;
    if (label === 'Department Head') {
      var dept = employee && store.department(employee.department);
      return (dept && dept.head) || hr;
    }
    if (label === 'IT Administrator' || label === 'Facilities') {
      return (store.employeeByName('Sandeep Rao') || {}).id || hr;
    }
    if (label === 'Organization Admin') return (store.persona('admin') || {}).id || hr;
    if (label === 'Finance Controller') {
      return (store.employeeByName('Deepak Joshi') || {}).id || hr;
    }
    return hr;
  }

  function submitResignation(employeeId, form) {
    var errors = rules.validResignation(form);
    if (rules.hasErrors(errors)) return fail(errors);
    var existing = store.collection('offboarding').filter(function (o) {
      return o.employee === employeeId && o.stage !== 'Completed';
    })[0];
    if (existing) return fail({ _: 'A resignation is already in progress' });
    var employee = store.employee(employeeId);
    var id = store.nextId('offboarding', 'OFB');
    /* From the configured checklist, not a list in the source: whatever HR has set
       up under offboarding configuration is what this exit has to clear. */
    var checklist = checklistFor(employee);
    var steps = (checklist && checklist.steps) || [];
    store.add('offboarding', {
      id: id, employee: employeeId, resignedOn: today(), resignedOnLabel: pretty(seed.today),
      lastWorkingDay: form.lastWorkingDay,
      lastWorkingDayLabel: pretty(new Date(form.lastWorkingDay + 'T00:00')),
      noticeDays: 60, reason: form.reason, comments: form.comments || '',
      replacement: form.replacement || null,
      /* The prototype keeps the name of what was attached, not the file. */
      attachment: form.attachment || null,
      stage: 'Submitted', status: 'Pending Approval',
      checklist: checklist ? checklist.id : null,
      checklistName: checklist ? checklist.name : null,
      tasksTotal: steps.length, tasksDone: 0, clearance: 0,
      assetsOutstanding: store.collection('assets').filter(function (a) { return a.assignedTo === employeeId; }).length,
      settlement: 'Pending',
      tasks: steps.map(function (st) {
        return {
          name: st.name, done: false, owner: ownerFor(st.owner, employee),
          ownerRole: st.owner, approver: st.approver,
          after: st.after, mandatory: st.mandatory, gate: st.gate
        };
      })
    });
    raiseApproval({
      id: id, kind: 'Resignation', module: 'offboarding', employee: employeeId,
      detail: 'Last working day ' + pretty(new Date(form.lastWorkingDay + 'T00:00')),
      approver: (store.persona('hr') || {}).id, route: 'hr/offboarding/resignations'
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
    /* Notifications */
    notify: notify, notifyEach: notifyEach,
    nextEmployeeId: nextEmployeeId, proposeWorkEmail: proposeWorkEmail,
    joinerQueue: joinerQueue, issueJoinerCredentials: issueJoinerCredentials,
    /* Employee records */
    createEmployee: createEmployee, editEmployee: editEmployee,
    changeEmployeeStatus: changeEmployeeStatus, importEmployees: importEmployees,
    requestProfileChange: requestProfileChange,
    saveEducationEntry: saveEducationEntry, deleteEducationEntry: deleteEducationEntry,
    /* Organization */
    createDepartment: createDepartment, createDesignation: createDesignation,
    createEmployeeType: createEmployeeType, updateEmployeeType: updateEmployeeType,
    deleteEmployeeType: deleteEmployeeType,
    createExitChecklist: createExitChecklist, updateExitChecklist: updateExitChecklist,
    deleteExitChecklist: deleteExitChecklist, exitChecklistFor: checklistFor,
    createApprovalWorkflow: createApprovalWorkflow, updateApprovalWorkflow: updateApprovalWorkflow,
    deleteApprovalWorkflow: deleteApprovalWorkflow,
    createEmployeeStatus: createEmployeeStatus, updateEmployeeStatus: updateEmployeeStatus,
    deleteEmployeeStatus: deleteEmployeeStatus,
    createLocation: createLocation, updateOrganization: updateOrganization,
    /* Users & roles */
    inviteUser: inviteUser, setUserStatus: setUserStatus, setUserRole: setUserRole, createRole: createRole,
    /* Leave */
    createLeaveType: createLeaveType, createLeavePolicy: createLeavePolicy,
    applyLeave: applyLeave, approveLeave: approveLeave, rejectLeave: rejectLeave, cancelLeave: cancelLeave,
    updateLeaveRequest: updateLeaveRequest,
    /* Attendance */
    checkIn: checkIn, checkOut: checkOut, requestRegularization: requestRegularization,
    approveRegularization: approveRegularization, rejectRegularization: rejectRegularization,
    /* Shifts */
    createShift: createShift, assignShift: assignShift, changeDefaultShift: changeDefaultShift,
    requestShiftSwap: requestShiftSwap, decideShiftSwap: decideShiftSwap,
    /* Documents */
    uploadDocument: uploadDocument, renameEmployeeDocument: renameEmployeeDocument,
    verifyDocument: verifyDocument,
    publishPolicy: publishPolicy, acknowledgePolicy: acknowledgePolicy,
    addHoliday: addHoliday, updateHoliday: updateHoliday, deleteHoliday: deleteHoliday,
    importHolidays: importHolidays,
    renameDocument: renameDocument, deleteDocument: deleteDocument,
    renameFolder: renameFolder, deleteFolder: deleteFolder,
    /* Assets */
    addAsset: addAsset, allocateAsset: allocateAsset, acknowledgeAsset: acknowledgeAsset,
    raiseAssetRequest: raiseAssetRequest, returnAsset: returnAsset,
    araAssetVerdict: araAssetVerdict, araAssetQueue: araAssetQueue,
    araDecideAssetRequests: araDecideAssetRequests, decideAssetRequest: decideAssetRequest,
    araAssetCap: ARA_ASSET_CAP, freeUnitFor: freeUnitFor, araJoinerKit: araJoinerKit,
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
    pinAnnouncement: pinAnnouncement, editAnnouncement: editAnnouncement,
    deleteAnnouncement: deleteAnnouncement,
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
