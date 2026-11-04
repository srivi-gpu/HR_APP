/* Sample data for the HRMS prototype, per PRD section 15.
   Nexora Technologies: 248 live employees across Hyderabad, Bengaluru and Pune.

   Two rules govern this file:
   1. Everything derives from a fixed seed, so every demo opens on the same numbers.
   2. The dashboard figures PRD 15 names are *reached by construction*, never hardcoded on a
      screen. The counts below are engineered so the values computed in store.stats() come out at
      248 total / 231 active / 12 new joiners / 18 on leave today / 14 pending leave /
      8 pending regularizations / 16 pending onboarding tasks / 7 pending asset requests.
      TARGETS at the bottom is asserted against the generated data, so drift fails loudly. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});

  var TODAY = new Date(2026, 10, 3);          // 3 November 2026
  var MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pretty(d) { return d.getDate() + ' ' + MONTH[d.getMonth()] + ' ' + d.getFullYear(); }
  var r = rng(20261103);
  function pick(list) { return list[Math.floor(r() * list.length)]; }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var ORG = {
    name: 'Nexora Technologies', industry: 'Technology / SaaS', size: '250 employees',
    website: 'nexoratech.com', currency: 'INR', timezone: 'Asia/Kolkata', weekStart: 'Monday',
    founded: 2016, workWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  };

  var ENTITIES = [
    { id: 'ent-in', name: 'Nexora Technologies Pvt Ltd', country: 'India', reg: 'U72200TG2016PTC114327', status: 'Active', primary: true }
  ];

  var LOCATIONS = [
    { id: 'loc-hyd', name: 'Hyderabad', label: 'Hyderabad (HQ)', entity: 'ent-in', tz: 'Asia/Kolkata', hq: true,
      address: 'Level 7, Cyber Gateway, HITEC City, Hyderabad 500081', target: 120, headcount: 0 },
    { id: 'loc-blr', name: 'Bengaluru', label: 'Bengaluru', entity: 'ent-in', tz: 'Asia/Kolkata',
      address: '4th Floor, Prestige Tech Park, Kadubeesanahalli, Bengaluru 560103', target: 80, headcount: 0 },
    { id: 'loc-pun', name: 'Pune', label: 'Pune', entity: 'ent-in', tz: 'Asia/Kolkata',
      address: 'Tower B, Panchshil Business Park, Baner, Pune 411045', target: 48, headcount: 0 }
  ];

  /* id, code, name, target headcount, head (by name) */
  var DEPARTMENTS = [
    { id: 'dep-eng', code: 'ENG', name: 'Engineering', target: 92, headName: 'Karthik Menon' },
    { id: 'dep-prd', code: 'PRD', name: 'Product', target: 24, headName: 'Deepak Joshi' },
    { id: 'dep-dsg', code: 'DSG', name: 'Design', target: 18, headName: 'Kavya Reddy' },
    { id: 'dep-hr', code: 'HR', name: 'Human Resources', target: 14, headName: 'Priya Sharma' },
    { id: 'dep-fin', code: 'FIN', name: 'Finance', target: 16, headName: 'Lakshmi Narayan' },
    { id: 'dep-mkt', code: 'MKT', name: 'Marketing', target: 22, headName: 'Shruti Deshpande' },
    { id: 'dep-sal', code: 'SAL', name: 'Sales', target: 38, headName: 'Vivek Chauhan' },
    { id: 'dep-ops', code: 'OPS', name: 'Operations', target: 24, headName: 'Rohit Khanna' }
  ];

  /* The designation list in PRD 15, with the job levels the hierarchy in 3.1 implies. */
  var DESIGNATIONS = [
    { id: 'des-asc', code: 'ASC', name: 'Associate', level: 1, reportsTo: 'des-tl', status: 'Active' },
    { id: 'des-sas', code: 'SAS', name: 'Senior Associate', level: 2, reportsTo: 'des-tl', status: 'Active' },
    { id: 'des-exe', code: 'EXE', name: 'Executive', level: 3, reportsTo: 'des-tl', status: 'Active' },
    { id: 'des-sex', code: 'SEX', name: 'Senior Executive', level: 4, reportsTo: 'des-tl', status: 'Active' },
    { id: 'des-tl', code: 'TL', name: 'Team Lead', level: 5, reportsTo: 'des-dir', status: 'Active' },
    { id: 'des-pm', code: 'PM', name: 'Product Manager', level: 5, reportsTo: 'des-dir', status: 'Active' },
    { id: 'des-em', code: 'EM', name: 'Engineering Manager', level: 6, reportsTo: 'des-dir', status: 'Active' },
    { id: 'des-hrm', code: 'HRM', name: 'HR Manager', level: 6, reportsTo: 'des-dir', status: 'Active' },
    { id: 'des-dir', code: 'DIR', name: 'Director', level: 7, reportsTo: null, status: 'Active' },
    /* Open headcount: approved as a position, nobody in it yet. It is here so the org
       chart has a vacancy to show, which is the reason positions are modelled apart
       from people in the first place. */
    { id: 'des-qal', code: 'QAL', name: 'QA Lead', level: 5, reportsTo: 'des-em', status: 'Open' }
  ];
  var desByName = {};
  DESIGNATIONS.forEach(function (d) { desByName[d.name] = d; });

  /* Roles are data, so the permission matrix can be edited rather than only read
     (PRD 10). `perms` holds only what has been changed away from the baseline in
     js/permissions.js, so the matrix there stays the single source of truth and a role
     with an empty `perms` is exactly what the PRD describes. `basedOn` is where a role
     falls back before the baseline, which is how Manager is an Employee with more.
     A system role can be re-permissioned but never renamed or deleted. */
  var ROLES = [
    { id: 'admin', name: 'Organization Admin', workspace: 'Admin', system: true, basedOn: null, users: 2, perms: {},
      description: 'Governs the organization, users, permissions, billing and platform configuration.' },
    { id: 'hr', name: 'HR Administrator', workspace: 'HR', system: true, basedOn: null, users: 4, perms: {},
      description: 'Operates the employee lifecycle, policies, workflows, payroll and performance.' },
    { id: 'manager', name: 'Manager', workspace: 'Employee', system: true, basedOn: 'me', users: 31, perms: {},
      description: 'An employee with team-level view and approval rights. Not a separate workspace.' },
    { id: 'me', name: 'Employee', workspace: 'Employee', system: true, basedOn: null, users: 248, perms: {},
      description: 'Self-service access to own records, requests and tasks.' }
  ];

  /* Teams sit under a department (PRD 3.2): the working groups people are actually in,
     which the department alone does not say. `lead` is a name so regenerating the
     employees cannot silently point a team at somebody else. */
  var TEAMS = [
    { id: 'tm-plat', name: 'Platform', department: 'dep-eng', leadName: 'Karthik Menon', members: 14 },
    { id: 'tm-mob', name: 'Mobile', department: 'dep-eng', leadName: 'Rahul Verma', members: 9 },
    { id: 'tm-qa', name: 'Quality', department: 'dep-eng', leadName: null, members: 7 },
    { id: 'tm-brand', name: 'Brand', department: 'dep-dsg', leadName: 'Kavya Reddy', members: 6 },
    { id: 'tm-prod', name: 'Product Design', department: 'dep-dsg', leadName: 'Ananya Rao', members: 8 },
    { id: 'tm-pay', name: 'Payroll ops', department: 'dep-fin', leadName: 'Lakshmi Narayan', members: 4 },
    { id: 'tm-ta', name: 'Talent acquisition', department: 'dep-hr', leadName: 'Priya Sharma', members: 5 },
    { id: 'tm-rev', name: 'Revenue', department: 'dep-sal', leadName: null, members: 11 }
  ];

  /* Employee numbering per entity (PRD 3.2). The prefix and width are what generated
     every employee ID in this prototype, so the preview below is the real next one. */
  var NUMBERING = [
    { id: 'num-in', entity: 'ent-in', prefix: 'NEX', width: 4, next: 263, resets: 'Never', applies: 'Employees' }
  ];

  /* ---------------------------------------------------------------------------
     Featured employees: hand-written so the thirteen scenarios in PRD 15 are all
     present and findable by name. Filler employees are generated after these.
     [name, dept, designation, type, status, location, months since joining]
  --------------------------------------------------------------------------- */
  var FEATURED = [
    ['Rohit Khanna', 'dep-ops', 'Director', 'Full-Time', 'Active', 'loc-hyd', 78],
    ['Priya Sharma', 'dep-hr', 'HR Manager', 'Full-Time', 'Active', 'loc-hyd', 62],
    ['Meera Iyer', 'dep-hr', 'Senior Executive', 'Full-Time', 'Active', 'loc-hyd', 26],
    ['Swati Jain', 'dep-hr', 'Executive', 'Full-Time', 'Onboarding', 'loc-hyd', 0],
    ['Karthik Menon', 'dep-eng', 'Engineering Manager', 'Full-Time', 'Active', 'loc-blr', 54],
    ['Arjun Nair', 'dep-eng', 'Team Lead', 'Full-Time', 'Active', 'loc-blr', 39],
    ['Sneha Kulkarni', 'dep-eng', 'Senior Executive', 'Full-Time', 'Active', 'loc-pun', 21],
    ['Vikram Desai', 'dep-eng', 'Executive', 'Full-Time', 'Active', 'loc-hyd', 30],
    ['Nisha Pillai', 'dep-eng', 'Senior Associate', 'Full-Time', 'Active', 'loc-blr', 15],
    ['Rahul Verma', 'dep-eng', 'Associate', 'Full-Time', 'Probation', 'loc-hyd', 1],
    ['Aisha Begum', 'dep-eng', 'Senior Executive', 'Full-Time', 'Active', 'loc-blr', 17],
    ['Varun Kapoor', 'dep-eng', 'Executive', 'Full-Time', 'Active', 'loc-pun', 23],
    ['Pranav Hegde', 'dep-eng', 'Associate', 'Full-Time', 'Onboarding', 'loc-blr', 0],
    ['Deepak Joshi', 'dep-prd', 'Director', 'Full-Time', 'Active', 'loc-hyd', 47],
    ['Tanvi Shah', 'dep-prd', 'Product Manager', 'Full-Time', 'Active', 'loc-hyd', 28],
    ['Imran Qureshi', 'dep-prd', 'Senior Associate', 'Full-Time', 'Active', 'loc-blr', 9],
    ['Sahil Bedi', 'dep-prd', 'Associate', 'Contract', 'Active', 'loc-pun', 6],
    ['Ishita Banerjee', 'dep-prd', 'Executive', 'Part-Time', 'Active', 'loc-hyd', 12],
    ['Kavya Reddy', 'dep-dsg', 'Team Lead', 'Full-Time', 'Active', 'loc-hyd', 36],
    ['Ananya Rao', 'dep-dsg', 'Senior Executive', 'Full-Time', 'Active', 'loc-hyd', 44],
    ['Farhan Ali', 'dep-dsg', 'Executive', 'Full-Time', 'Active', 'loc-blr', 13],
    ['Riya Malhotra', 'dep-dsg', 'Associate', 'Intern', 'Probation', 'loc-hyd', 2],
    ['Aditya Ghosh', 'dep-dsg', 'Senior Executive', 'Full-Time', 'Notice Period', 'loc-blr', 32],
    ['Lakshmi Narayan', 'dep-fin', 'Director', 'Full-Time', 'Active', 'loc-hyd', 66],
    ['Suresh Babu', 'dep-fin', 'Senior Executive', 'Full-Time', 'Active', 'loc-hyd', 38],
    ['Pooja Agarwal', 'dep-fin', 'Executive', 'Full-Time', 'Active', 'loc-pun', 19],
    ['Shruti Deshpande', 'dep-mkt', 'Team Lead', 'Full-Time', 'Active', 'loc-blr', 42],
    ['Anjali Mehta', 'dep-mkt', 'Executive', 'Full-Time', 'Active', 'loc-hyd', 14],
    ['Zoya Khan', 'dep-mkt', 'Associate', 'Intern', 'Active', 'loc-blr', 4],
    ['Vivek Chauhan', 'dep-sal', 'Director', 'Full-Time', 'Active', 'loc-hyd', 52],
    ['Harsha Vardhan', 'dep-sal', 'Senior Executive', 'Full-Time', 'Active', 'loc-blr', 25],
    ['Divya Krishnan', 'dep-sal', 'Executive', 'Full-Time', 'Active', 'loc-pun', 20],
    ['Manoj Tiwari', 'dep-sal', 'Associate', 'Full-Time', 'Probation', 'loc-hyd', 2],
    ['Neha Choudhary', 'dep-ops', 'Team Lead', 'Full-Time', 'Active', 'loc-hyd', 31],
    ['Sandeep Rao', 'dep-ops', 'Senior Executive', 'Full-Time', 'Active', 'loc-hyd', 44],
    ['Ravi Shankar', 'dep-ops', 'Associate', 'Full-Time', 'Active', 'loc-pun', 8],
    ['Mohan Das', 'dep-ops', 'Executive', 'Consultant', 'Active', 'loc-blr', 7]
  ];

  var FIRST = ['Aarav', 'Aditi', 'Advait', 'Akash', 'Alok', 'Amit', 'Ananth', 'Anil', 'Ankita', 'Anusha',
    'Apoorva', 'Arvind', 'Ashwin', 'Bhavya', 'Chaitanya', 'Charan', 'Deepa', 'Dhruv', 'Gautam', 'Gayatri',
    'Girish', 'Hari', 'Hemant', 'Indira', 'Jatin', 'Jyoti', 'Kabir', 'Kalyan', 'Kiran', 'Kunal',
    'Lavanya', 'Madhav', 'Mahesh', 'Mallika', 'Mandeep', 'Naveen', 'Nikita', 'Nitin', 'Omkar', 'Pallavi',
    'Parth', 'Prerna', 'Rachit', 'Radhika', 'Raghav', 'Rakesh', 'Ramya', 'Rashmi', 'Rohan', 'Rupa',
    'Sagar', 'Sailesh', 'Sameer', 'Sanjana', 'Sarika', 'Shashank', 'Shilpa', 'Siddharth', 'Smita', 'Sridhar',
    'Sudha', 'Sumanth', 'Tarun', 'Trisha', 'Uday', 'Usha', 'Vaishnavi', 'Venkat', 'Vidya', 'Yashwanth'];
  var LAST = ['Acharya', 'Agnihotri', 'Bajaj', 'Bhandari', 'Chakraborty', 'Chandran', 'Dasgupta', 'Dhawan',
    'Dixit', 'Gokhale', 'Grover', 'Gupta', 'Hegde', 'Jadhav', 'Kamath', 'Kaul', 'Khatri', 'Kohli',
    'Lal', 'Madan', 'Mahajan', 'Mani', 'Mishra', 'Mukherjee', 'Nadkarni', 'Nambiar', 'Oberoi', 'Pandey',
    'Patel', 'Prabhu', 'Raghunathan', 'Rastogi', 'Sampath', 'Sarin', 'Sethi', 'Shetty', 'Sinha', 'Sridharan',
    'Subramanian', 'Thakur', 'Trivedi', 'Varma', 'Venkatesh', 'Wadhwa', 'Yadav'];

  /* Which designation a filler employee gets, weighted so the pyramid looks real. */
  var IC_MIX = ['Associate', 'Associate', 'Associate', 'Senior Associate', 'Senior Associate',
    'Executive', 'Executive', 'Executive', 'Senior Executive', 'Senior Executive', 'Team Lead'];
  var TYPE_MIX = ['Full-Time', 'Full-Time', 'Full-Time', 'Full-Time', 'Full-Time', 'Full-Time',
    'Full-Time', 'Full-Time', 'Full-Time', 'Contract', 'Part-Time', 'Intern'];

  /* Status plan for the 211 filler employees, summing with FEATURED to PRD 15's totals. */
  var FILLER_STATUS = { Active: 200, Probation: 3, Onboarding: 2, Invited: 2, 'Notice Period': 3, Suspended: 1 };

  var employees = [];
  var seq = 0;
  var usedNames = {};
  FEATURED.forEach(function (f) { usedNames[f[0]] = true; });

  function nextName() {
    for (var i = 0; i < 4000; i++) {
      var n = pick(FIRST) + ' ' + pick(LAST);
      if (!usedNames[n]) { usedNames[n] = true; return n; }
    }
    throw new Error('ran out of unique names');
  }

  function makeEmployee(name, dept, designation, type, status, loc, monthsAgo, joinedOverride) {
    seq += 1;
    var id = 'NEX' + String(seq).padStart(4, '0');
    var joined = joinedOverride || addDays(TODAY, -Math.round(monthsAgo * 30.4) - Math.floor(r() * 14));
    var des = desByName[designation];
    /* CTC tracks job level, with spread inside the band. */
    var base = [0, 550000, 800000, 1200000, 1800000, 2800000, 3200000, 4200000, 6500000][des.level];
    var ctc = Math.round((base * (0.85 + r() * 0.35)) / 10000) * 10000;
    /* An intern on a level-1 band would be drawing more than a junior engineer, which
       is not what a stipend is. Part-timers are paid for the hours they work, so they
       sit below the band too. Both land where employee state insurance and the lower
       professional tax slabs actually apply — which is the point: a payroll that only
       ever pays well-paid people never exercises the statutory floor. */
    if (type === 'Intern') ctc = Math.round((240000 * (0.8 + r() * 0.5)) / 10000) * 10000;
    else if (type === 'Part-Time') ctc = Math.round((ctc * 0.45) / 10000) * 10000;
    var mail = name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ +/g, '.');
    return {
      id: id, name: name, department: dept, designation: designation, designationId: des.id,
      level: des.level, type: type, status: status, location: loc,
      joined: iso(joined), joinedLabel: pretty(joined),
      workEmail: mail + '@nexoratech.com',
      personalEmail: mail.replace(/\./g, '') + '@gmail.com',
      phone: '+91 9' + String(100000000 + Math.floor(r() * 899999999)).slice(0, 9),
      ctc: ctc,
      dob: iso(addDays(TODAY, -Math.floor(7600 + r() * 6600))),
      gender: r() < 0.44 ? 'Female' : 'Male',
      probationMonths: type === 'Full-Time' ? 6 : 3,
      shift: r() < 0.8 ? 'sh-gen' : (r() < 0.6 ? 'sh-mor' : 'sh-eve'),
      leavePolicy: type === 'Intern' ? 'lp-intern' : type === 'Contract' || type === 'Consultant' ? 'lp-contract' : 'lp-standard',
      attendancePolicy: 'ap-standard',
      manager: null,                       // filled in once everyone exists
      bank: { name: pick(['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank']),
        account: 'XXXXXX' + String(1000 + Math.floor(r() * 8999)), ifsc: 'HDFC000' + String(1000 + Math.floor(r() * 8999)) },
      emergency: { name: nextEmergencyName(name), relation: pick(['Spouse', 'Parent', 'Sibling']), phone: '+91 9' + String(100000000 + Math.floor(r() * 899999999)).slice(0, 9) }
    };
  }
  function nextEmergencyName(of) { return pick(FIRST) + ' ' + of.split(' ').slice(-1)[0]; }

  FEATURED.forEach(function (f) {
    var joined = f[4] === 'Onboarding'
      ? addDays(TODAY, f[0] === 'Pranav Hegde' ? -2 : -1)     // both joined this month
      : null;
    employees.push(makeEmployee(f[0], f[1], f[2], f[3], f[4], f[5], f[6], joined));
  });

  /* Filler: fill each department and location to target, and spend the status plan. */
  var statusPool = [];
  Object.keys(FILLER_STATUS).forEach(function (st) {
    for (var i = 0; i < FILLER_STATUS[st]; i++) statusPool.push(st);
  });
  statusPool = shuffle(statusPool);

  var locPool = [];
  LOCATIONS.forEach(function (l) {
    var already = employees.filter(function (e) { return e.location === l.id; }).length;
    for (var i = 0; i < l.target - already; i++) locPool.push(l.id);
  });
  locPool = shuffle(locPool);

  var deptPool = [];
  DEPARTMENTS.forEach(function (d) {
    var already = employees.filter(function (e) { return e.department === d.id; }).length;
    for (var i = 0; i < d.target - already; i++) deptPool.push(d.id);
  });
  deptPool = shuffle(deptPool);

  /* Exactly 10 filler employees joined this month, so together with Swati Jain and
     Pranav Hegde the computed figure lands on PRD 15's 12. Anyone Invited or Onboarding
     is joining now and so must be inside that 10, not added on top of it. */
  var NEW_JOINER_FILLER = 10;
  var newJoinerIdx = {}, newCount = 0, k;
  for (k = 0; k < statusPool.length; k++) {
    if (statusPool[k] === 'Invited' || statusPool[k] === 'Onboarding') { newJoinerIdx[k] = true; newCount++; }
  }
  for (k = 0; k < statusPool.length && newCount < NEW_JOINER_FILLER; k++) {
    if (!newJoinerIdx[k] && statusPool[k] === 'Active') { newJoinerIdx[k] = true; newCount++; }
  }

  for (k = 0; k < deptPool.length; k++) {
    var st = statusPool[k];
    var isNew = !!newJoinerIdx[k];
    var joined = isNew ? addDays(TODAY, -Math.floor(r() * 3)) : null;
    employees.push(makeEmployee(
      nextName(), deptPool[k],
      st === 'Probation' || st === 'Invited' || st === 'Onboarding' ? pick(['Associate', 'Senior Associate', 'Executive']) : pick(IC_MIX),
      pick(TYPE_MIX), st, locPool[k],
      isNew ? 0 : 2 + Math.floor(r() * 70), joined
    ));
  }

  /* Exited employees, archived and excluded from headcount (PRD 14.1). */
  var EXITED = 14;
  for (var x = 0; x < EXITED; x++) {
    employees.push(makeEmployee(nextName(), pick(DEPARTMENTS).id, pick(IC_MIX), 'Full-Time', 'Exited', pick(LOCATIONS).id, 14 + Math.floor(r() * 60)));
  }

  var byId = {}, byName = {};
  employees.forEach(function (e) { byId[e.id] = e; byName[e.name] = e; });
  function id(name) { return byName[name].id; }

  /* Department heads, then managers: everyone reports up to their department head,
     except leads and above, who report to the head directly. */
  DEPARTMENTS.forEach(function (d) { d.head = id(d.headName); d.location = byName[d.headName].location; });
  var headOf = {};
  DEPARTMENTS.forEach(function (d) { headOf[d.id] = d.head; });
  var leadsBy = {};
  DEPARTMENTS.forEach(function (d) {
    leadsBy[d.id] = employees.filter(function (e) {
      return e.department === d.id && e.level >= 5 && e.id !== d.head && e.status !== 'Exited';
    }).map(function (e) { return e.id; });
  });
  employees.forEach(function (e) {
    if (e.id === headOf[e.department]) { e.manager = id('Rohit Khanna') === e.id ? null : id('Rohit Khanna'); return; }
    var leads = leadsBy[e.department];
    e.manager = e.level >= 5 || !leads.length ? headOf[e.department] : leads[Math.floor(r() * leads.length)];
  });

  LOCATIONS.forEach(function (l) {
    l.headcount = employees.filter(function (e) { return e.location === l.id && e.status !== 'Exited'; }).length;
  });
  DEPARTMENTS.forEach(function (d) {
    d.headcount = employees.filter(function (e) { return e.department === d.id && e.status !== 'Exited'; }).length;
  });

  var live = employees.filter(function (e) { return e.status !== 'Exited'; });

  /* ------------------------------------------------------------------ Leave */
  var LEAVE_TYPES = [
    { id: 'lt-cl', code: 'CL', name: 'Casual Leave', paid: true, annual: 12, carry: false, maxConsecutive: 3, notice: 1, docRequired: false, halfDay: true },
    { id: 'lt-sl', code: 'SL', name: 'Sick Leave', paid: true, annual: 12, carry: false, maxConsecutive: 7, notice: 0, docRequired: true, halfDay: true },
    { id: 'lt-el', code: 'EL', name: 'Earned Leave', paid: true, annual: 18, carry: true, maxAccrual: 45, notice: 7, docRequired: false, halfDay: true },
    { id: 'lt-ml', code: 'ML', name: 'Maternity Leave', paid: true, annual: 182, carry: false, notice: 30, docRequired: true, halfDay: false },
    { id: 'lt-pl', code: 'PL', name: 'Paternity Leave', paid: true, annual: 10, carry: false, notice: 15, docRequired: true, halfDay: false },
    { id: 'lt-co', code: 'CO', name: 'Compensatory Off', paid: true, annual: 0, carry: true, notice: 1, docRequired: false, halfDay: true },
    { id: 'lt-up', code: 'UP', name: 'Unpaid Leave', paid: false, annual: 0, carry: false, notice: 7, docRequired: false, halfDay: false }
  ];
  var LEAVE_POLICIES = [
    { id: 'lp-standard', name: 'Standard — Full-Time', appliesTo: 'Full-Time employees past probation', types: ['lt-cl', 'lt-sl', 'lt-el', 'lt-ml', 'lt-pl', 'lt-co', 'lt-up'], status: 'Active' },
    { id: 'lp-intern', name: 'Interns', appliesTo: 'Interns and trainees', types: ['lt-cl', 'lt-sl', 'lt-up'], status: 'Active' },
    { id: 'lp-contract', name: 'Contract & Consultant', appliesTo: 'Contract, consultant and part-time', types: ['lt-cl', 'lt-sl', 'lt-up'], status: 'Active' }
  ];

  var SHIFTS = [
    { id: 'sh-gen', code: 'GEN', name: 'General Shift', start: '09:00', end: '18:00', breakMins: 60, grace: 15, night: false, days: 'Mon–Fri', status: 'Active' },
    { id: 'sh-mor', code: 'MOR', name: 'Morning Shift', start: '06:00', end: '14:00', breakMins: 45, grace: 10, night: false, days: 'Mon–Sat', status: 'Active' },
    { id: 'sh-eve', code: 'EVE', name: 'Evening Shift', start: '14:00', end: '22:00', breakMins: 45, grace: 10, night: false, days: 'Mon–Sat', status: 'Active' },
    { id: 'sh-ngt', code: 'NGT', name: 'Night Shift', start: '22:00', end: '06:00', breakMins: 60, grace: 10, night: true, days: 'Mon–Fri', status: 'Active' }
  ];

  var balances = {};

  /* The ledger behind every balance: how the number on the Balances screen was arrived
     at, line by line. It is derived from the balance rather than invented beside it, so
     the two can never disagree — the opening, the accruals and the days taken always sum
     back to `available`. Earned leave carries forward and may be encashed; the rest
     lapses at year end, which is why only EL gets those lines. */
  var leaveLedger = [];
  var LEDGER_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  function ledgerLine(employee, type, date, kind, days, note) {
    leaveLedger.push({
      id: 'll' + (leaveLedger.length + 1), employee: employee, type: type,
      date: date, kind: kind, days: Math.round(days * 10) / 10, note: note
    });
  }

  live.forEach(function (e) {
    var policy = LEAVE_POLICIES.filter(function (p) { return p.id === e.leavePolicy; })[0];
    balances[e.id] = LEAVE_TYPES.filter(function (t) {
      return policy.types.indexOf(t.id) >= 0 && t.annual > 0 && t.annual < 100;
    }).map(function (t) {
      var used = Math.floor(r() * (t.annual * 0.72));

      /* Earned leave opens with what was carried over; everything else opens at nil. */
      var carried = t.carry ? Math.min(Math.floor(r() * 8), t.maxAccrual ? t.maxAccrual - t.annual : 8) : 0;
      if (carried > 0) ledgerLine(e.id, t.id, '2026-01-01', 'Carried forward', carried, 'Unused balance from 2025');
      else ledgerLine(e.id, t.id, '2026-01-01', 'Opening', 0, 'Nothing carried into the year');

      /* Granted monthly where it accrues, in one go where it does not. */
      var monthly = t.id === 'lt-el';
      if (monthly) {
        var perMonth = t.annual / 12;
        for (var m = 1; m <= 12; m++) {
          ledgerLine(e.id, t.id, '2026-' + (m < 10 ? '0' + m : m) + '-01', 'Accrued', perMonth,
            perMonth.toFixed(1) + ' days for ' + LEDGER_MONTHS[m - 1]);
        }
      } else {
        ledgerLine(e.id, t.id, '2026-01-01', 'Granted', t.annual, 'Annual entitlement under ' + policy.name);
      }

      if (used > 0) ledgerLine(e.id, t.id, '2026-' + (r() < .5 ? '06' : '09') + '-12', 'Taken', -used, used + ' days approved and taken');

      /* Encashment only happens where leave carries, and only above a floor. */
      var encashed = (t.carry && carried > 4) ? 2 : 0;
      if (encashed) ledgerLine(e.id, t.id, '2026-03-31', 'Encashed', -encashed, 'Two days encashed with March payroll');

      /* Available is what the ledger adds up to, not entitlement minus days taken: leave
         carried in counts toward it and leave encashed has already been paid out. The two
         views are the same arithmetic, so the Balances screen and the ledger behind it
         cannot disagree. */
      return {
        type: t.id, entitled: t.annual, used: used, carried: carried, encashed: encashed,
        available: t.annual + carried - used - encashed
      };
    });
  });

  var LEAVE_REASONS = {
    'lt-cl': ['Family function', 'Personal errand', 'Short trip', 'House shifting', 'Festival at home'],
    'lt-sl': ['Fever, rest advised', 'Dental procedure', 'Viral infection', 'Medical check-up', 'Recovering from surgery'],
    'lt-el': ['Annual holiday', 'Wedding in the family', 'Travel abroad', 'Extended break', 'Visiting parents'],
    'lt-pl': ['Paternity leave'], 'lt-ml': ['Maternity leave'],
    'lt-co': ['Comp off for weekend release'], 'lt-up': ['Unpaid personal leave']
  };

  var leaveRequests = [];
  var lvSeq = 1200;
  function addLeave(employee, typeId, from, days, status, opts) {
    opts = opts || {};
    var to = addDays(from, days - 1);
    lvSeq += 1;
    leaveRequests.push({
      id: 'LV' + lvSeq, employee: employee, type: typeId,
      from: iso(from), to: iso(to), fromLabel: pretty(from), toLabel: pretty(to),
      days: days, halfDay: !!opts.halfDay,
      reason: opts.reason || pick(LEAVE_REASONS[typeId] || ['Personal']),
      status: status, approver: byId[employee].manager || id('Priya Sharma'),
      appliedOn: iso(addDays(from, -(1 + Math.floor(r() * 10)))),
      decidedOn: status === 'Pending Approval' ? null : iso(addDays(from, -1)),
      decidedBy: status === 'Pending Approval' ? null : (byId[employee].manager || id('Priya Sharma'))
    });
  }

  /* The employee workspace signs in as this person (it must match nav.js). Their day is
     left un-punched and leave-free so the check-in and check-out flow of PRD 19 can
     actually be exercised, rather than being blocked by a seeded punch. */
  var SELF_PERSONA = id('Ananya Rao');

  /* 1. Exactly 18 employees are on approved leave across today (PRD 15). */
  var ON_LEAVE_TODAY = 18;
  var eligible = live.filter(function (e) { return e.status === 'Active' || e.status === 'Probation'; });
  var onLeavePool = shuffle(eligible.filter(function (e) { return e.id !== SELF_PERSONA; })).slice(0, ON_LEAVE_TODAY);
  var onLeaveIds = {};
  onLeavePool.forEach(function (e) {
    onLeaveIds[e.id] = true;
    var span = 1 + Math.floor(r() * 4);
    var startOffset = -Math.floor(r() * span);                 // today falls inside the span
    addLeave(e.id, pick(['lt-cl', 'lt-sl', 'lt-el']), addDays(TODAY, startOffset), span, 'Approved');
  });

  /* Leave already booked ahead, spread across every department. The generator above only
     places leave that is in progress or behind, so nobody had time off coming — which left
     the employee's leave portal showing an empty "booked ahead" and an empty team view to
     whoever signed in. Two or three people per department, a few weeks out. */
  var upcomingByDept = {};
  live.forEach(function (e) {
    if (!e.department) return;
    (upcomingByDept[e.department] = upcomingByDept[e.department] || []).push(e);
  });
  Object.keys(upcomingByDept).forEach(function (dep) {
    upcomingByDept[dep].slice(0, 3).forEach(function (e, i) {
      if (onLeaveIds[e.id]) return;
      addLeave(e.id, pick(['lt-cl', 'lt-el', 'lt-sl']), addDays(TODAY, 6 + i * 9 + Math.floor(r() * 5)),
        1 + Math.floor(r() * 3), 'Approved');
    });
  });
  /* Scenario 5 of PRD 15 — a named employee with approved leave. */
  addLeave(id('Anjali Mehta'), 'lt-el', addDays(TODAY, 12), 5, 'Approved', { reason: 'Wedding in the family' });

  /* 2. Exactly 14 pending leave requests (PRD 15). Sneha Kulkarni is scenario 4. */
  var PENDING_LEAVE = 14;
  addLeave(id('Sneha Kulkarni'), 'lt-sl', addDays(TODAY, 1), 2, 'Pending Approval', { reason: 'Fever, rest advised' });
  var pendingPool = shuffle(eligible.filter(function (e) { return !onLeaveIds[e.id] && e.name !== 'Sneha Kulkarni'; })).slice(0, PENDING_LEAVE - 1);
  pendingPool.forEach(function (e) {
    addLeave(e.id, pick(['lt-cl', 'lt-sl', 'lt-el', 'lt-co']), addDays(TODAY, 2 + Math.floor(r() * 24)), 1 + Math.floor(r() * 4), 'Pending Approval');
  });

  /* 3. History: settled requests in the past, so reports have something to show. */
  var historyPool = shuffle(eligible).slice(0, 70);
  historyPool.forEach(function (e) {
    var n = 1 + Math.floor(r() * 2);
    for (var i = 0; i < n; i++) {
      addLeave(e.id, pick(['lt-cl', 'lt-sl', 'lt-el', 'lt-pl']),
        addDays(TODAY, -(10 + Math.floor(r() * 240))), 1 + Math.floor(r() * 3),
        r() < 0.86 ? 'Approved' : 'Rejected');
    }
  });
  addLeave(id('Ananya Rao'), 'lt-el', addDays(TODAY, -46), 4, 'Approved', { reason: 'Annual holiday' });
  leaveRequests.sort(function (a, b) { return a.appliedOn < b.appliedOn ? 1 : -1; });

  /* -------------------------------------------------------------- Attendance */
  var attendanceToday = [];
  var MISSING_PUNCH = 6, LATE = 11, ABSENT = 5, WFH = 34;
  /* The self-service persona is held out of the plan, so the engineered late, absent,
     work-from-home and missing-punch counts are untouched — only the Present padding
     shrinks by one — and their own record below is left un-punched. */
  var working = live.filter(function (e) {
    return e.status !== 'Invited' && e.status !== 'Onboarding' && e.status !== 'Suspended'
      && !onLeaveIds[e.id] && e.id !== SELF_PERSONA;
  });
  var plan = [];
  for (var i = 0; i < MISSING_PUNCH; i++) plan.push('Missing Punch');
  for (i = 0; i < LATE; i++) plan.push('Late');
  for (i = 0; i < ABSENT; i++) plan.push('Absent');
  for (i = 0; i < WFH; i++) plan.push('Work From Home');
  while (plan.length < working.length) plan.push('Present');
  plan = shuffle(plan);

  /* Vikram Desai must have a missing punch — scenario 6 needs a regularization. */
  var vikramIdx = working.findIndex(function (e) { return e.name === 'Vikram Desai'; });
  var mpIdx = plan.indexOf('Missing Punch');
  if (vikramIdx >= 0 && mpIdx >= 0) { var tmp = plan[vikramIdx]; plan[vikramIdx] = 'Missing Punch'; plan[mpIdx] = tmp; }

  function clockAt(base, add) {
    var m = Number(base.slice(0, 2)) * 60 + Number(base.slice(3)) + add;
    return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
  }
  working.forEach(function (e, idx) {
    var st = plan[idx];
    var shift = SHIFTS.filter(function (s) { return s.id === e.shift; })[0];
    var late = st === 'Late';
    var inOffset = late ? shift.grace + 8 + Math.floor(r() * 46) : Math.floor(r() * 12) - 7;
    var punched = st !== 'Absent';
    attendanceToday.push({
      id: 'AT-' + e.id, employee: e.id, date: iso(TODAY), status: st, shift: e.shift,
      checkIn: punched ? clockAt(shift.start, inOffset) : null,
      checkOut: punched && st !== 'Missing Punch' ? clockAt(shift.end, Math.floor(r() * 44) - 12) : null,
      lateBy: late ? inOffset - shift.grace : 0,
      hours: punched && st !== 'Missing Punch' ? Math.round((8 + (r() * 1.6 - 0.6)) * 10) / 10 : 0,
      source: st === 'Work From Home' ? 'Web' : pick(['Biometric', 'Biometric', 'Web', 'Mobile'])
    });
  });
  onLeavePool.forEach(function (e) {
    attendanceToday.push({ id: 'AT-' + e.id, employee: e.id, date: iso(TODAY), status: 'On Leave', shift: e.shift, checkIn: null, checkOut: null, lateBy: 0, hours: 0, source: null });
  });
  live.filter(function (e) { return e.status === 'Invited' || e.status === 'Onboarding' || e.status === 'Suspended'; })
    .forEach(function (e) {
      attendanceToday.push({ id: 'AT-' + e.id, employee: e.id, date: iso(TODAY), status: 'Not Started', shift: e.shift, checkIn: null, checkOut: null, lateBy: 0, hours: 0, source: null });
    });
  /* The signed-in employee has not punched yet today. */
  attendanceToday.push({
    id: 'AT-' + SELF_PERSONA, employee: SELF_PERSONA, date: iso(TODAY), status: 'Yet to Check In',
    shift: byId[SELF_PERSONA].shift, checkIn: null, checkOut: null, lateBy: 0, hours: 0, source: null
  });

  /* --------------------------------------------------- Regularization: 8 pending */
  var regularizations = [];
  var PENDING_REGS = 8;
  var regSeq = 480;
  function addReg(employee, dayOffset, status, opts) {
    opts = opts || {};
    var d = addDays(TODAY, dayOffset);
    regSeq += 1;
    regularizations.push({
      id: 'RG' + regSeq, employee: employee, date: iso(d), dateLabel: pretty(d),
      issue: opts.issue || pick(['Missing check-out', 'Missing check-in', 'Wrong punch time', 'Marked absent in error']),
      original: opts.original || pick(['— / 18:12', '09:48 / —', '10:22 / 18:05', '— / —']),
      corrected: opts.corrected || pick(['09:05 / 18:12', '09:10 / 18:30', '09:00 / 18:00']),
      reason: opts.reason || pick(['Forgot to punch out', 'Biometric did not register', 'Client visit, punched from site', 'System outage that morning']),
      status: status, approver: byId[employee].manager || id('Priya Sharma')
    });
  }
  addReg(id('Vikram Desai'), -1, 'Pending Approval', { issue: 'Missing check-out', original: '09:02 / —', corrected: '09:02 / 18:20', reason: 'Forgot to punch out after the release call' });
  var regPool = shuffle(eligible.filter(function (e) { return e.name !== 'Vikram Desai'; }));
  regPool.slice(0, PENDING_REGS - 1).forEach(function (e, n) { addReg(e.id, -(2 + n), 'Pending Approval'); });
  regPool.slice(PENDING_REGS, PENDING_REGS + 9).forEach(function (e, n) {
    addReg(e.id, -(10 + n), r() < 0.78 ? 'Approved' : 'Rejected');
  });

  /* ------------------------------------------------------------------ Holidays */
  var HOLIDAYS = [
    { date: '2026-01-01', name: "New Year's Day", type: 'Public' },
    { date: '2026-01-26', name: 'Republic Day', type: 'National' },
    { date: '2026-03-04', name: 'Holi', type: 'Public' },
    { date: '2026-04-14', name: 'Ambedkar Jayanti', type: 'Public' },
    { date: '2026-05-01', name: 'May Day', type: 'Public' },
    { date: '2026-08-15', name: 'Independence Day', type: 'National' },
    { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'National' },
    { date: '2026-11-08', name: 'Diwali', type: 'Public' },
    { date: '2026-11-09', name: 'Diwali (second day)', type: 'Optional' },
    { date: '2026-12-25', name: 'Christmas Day', type: 'Public' }
  ];

  /* -------------------------------------------------------------------- Assets */
  var ASSET_CATS = [
    { name: 'Laptop', brands: ['Apple MacBook Pro 14', 'Dell Latitude 7450', 'Lenovo ThinkPad X1'], value: [95000, 185000] },
    { name: 'Monitor', brands: ['Dell U2724D', 'LG 27UP850', 'Samsung ViewFinity S6'], value: [18000, 42000] },
    { name: 'Mobile Phone', brands: ['Apple iPhone 15', 'Samsung Galaxy S24'], value: [55000, 95000] },
    { name: 'Headset', brands: ['Jabra Evolve2 65', 'Logitech Zone Vibe', 'Sony WH-1000XM5'], value: [8000, 32000] },
    { name: 'Keyboard', brands: ['Logitech MX Keys', 'Keychron K3'], value: [6000, 12000] },
    { name: 'Access Card', brands: ['HID ProxCard'], value: [500, 900] },
    { name: 'Tablet', brands: ['Apple iPad Air', 'Samsung Galaxy Tab S9'], value: [52000, 78000] },
    { name: 'Docking Station', brands: ['Dell WD19S', 'CalDigit TS4'], value: [14000, 38000] }
  ];
  var assets = [];
  var astSeq = 3100;
  function addAsset(catIdx, holderId, status, loc) {
    var cat = ASSET_CATS[catIdx];
    astSeq += 1;
    var purchased = addDays(TODAY, -Math.floor(30 + r() * 1300));
    return assets.push({
      id: 'AST' + astSeq, name: pick(cat.brands), category: cat.name,
      serial: 'SN' + String(Math.floor(r() * 9e8) + 1e8),
      status: status, assignedTo: holderId, location: loc,
      purchased: iso(purchased), purchasedLabel: pretty(purchased),
      value: Math.round((cat.value[0] + r() * (cat.value[1] - cat.value[0])) / 500) * 500,
      warranty: iso(addDays(purchased, 1095)),
      condition: status === 'Damaged' ? 'Damaged' : pick(['Excellent', 'Good', 'Good', 'Fair']),
      assignedOn: holderId ? iso(addDays(TODAY, -Math.floor(20 + r() * 700))) : null,
      acknowledged: holderId ? r() < 0.92 : null
    });
  }
  /* Every working employee holds a laptop and an access card; extras are spread around. */
  live.filter(function (e) { return e.status !== 'Invited'; }).forEach(function (e) {
    addAsset(0, e.id, 'Assigned', e.location);
    addAsset(5, e.id, 'Assigned', e.location);
    if (r() < 0.55) addAsset(1, e.id, 'Assigned', e.location);
    if (r() < 0.3) addAsset(3, e.id, 'Assigned', e.location);
    if (r() < 0.12) addAsset(2, e.id, 'Assigned', e.location);
  });
  for (i = 0; i < 46; i++) {
    addAsset(Math.floor(r() * ASSET_CATS.length), null,
      pick(['Available', 'Available', 'Available', 'Under Maintenance', 'Damaged', 'Retired']), pick(LOCATIONS).id);
  }

  /* Asset requests: exactly 7 pending (PRD 15). Farhan Ali is scenario 8. */
  var assetRequests = [];
  var arSeq = 9000;
  function addAssetRequest(employee, category, reason, status) {
    arSeq += 1;
    assetRequests.push({
      id: 'AR' + arSeq, employee: employee, category: category, reason: reason, status: status,
      requestedOn: iso(addDays(TODAY, -Math.floor(1 + r() * 20))),
      approver: id('Sandeep Rao')
    });
  }
  addAssetRequest(id('Farhan Ali'), 'Monitor', 'Dual screen setup for research sessions', 'Pending Approval');
  var arPool = shuffle(eligible.filter(function (e) { return e.name !== 'Farhan Ali'; }));
  var AR_PENDING = 7;
  arPool.slice(0, AR_PENDING - 1).forEach(function (e) {
    addAssetRequest(e.id, pick(['Laptop', 'Monitor', 'Headset', 'Docking Station', 'Mobile Phone']),
      pick(['Replacement — battery fault', 'New joiner setup', 'Upgrade for design work', 'Travelling to client site', 'Existing unit damaged']), 'Pending Approval');
  });
  arPool.slice(AR_PENDING, AR_PENDING + 11).forEach(function (e) {
    addAssetRequest(e.id, pick(['Laptop', 'Monitor', 'Headset']), pick(['Replacement', 'Upgrade', 'New setup']), r() < 0.75 ? 'Approved' : 'Rejected');
  });

  /* Inventory has to be able to satisfy the pending requests, or approving one dead-ends
     on the PRD 14.5 "asset unavailable" refusal and the allocation path in PRD 19 cannot
     be walked at all. One spare unit per open request, added to whatever stock exists. */
  assetRequests.filter(function (req) { return req.status === 'Pending Approval'; }).forEach(function (req) {
    var catIdx = 0;
    ASSET_CATS.forEach(function (c, n) { if (c.name === req.category) catIdx = n; });
    addAsset(catIdx, null, 'Available', byId[req.employee].location);
  });

  /* --------------------------------------- Onboarding: 16 pending tasks (PRD 15) */
  var ONB_TASKS = ['Personal information', 'Employment details', 'Document collection', 'Document verification',
    'IT setup', 'Asset allocation', 'Policy acknowledgement', 'Department introduction',
    'Manager introduction', 'Orientation session', 'Payroll enrolment', 'Buddy assignment'];
  var onboarding = [];
  var onbPeople = live.filter(function (e) { return e.status === 'Onboarding' || e.status === 'Invited'; });
  /* Remaining tasks per case, summing to 16. */
  var REMAINING = [4, 3, 3, 2, 2, 2];
  onbPeople.forEach(function (e, n) {
    var remaining = REMAINING[n] != null ? REMAINING[n] : 0;
    var total = ONB_TASKS.length;
    var done = total - remaining;
    onboarding.push({
      id: 'ONB' + (210 + n), employee: e.id,
      template: e.type === 'Intern' ? 'tpl-intern' : 'tpl-standard',
      startDate: e.joined, startDateLabel: e.joinedLabel,
      tasksTotal: total, tasksDone: done, pending: remaining,
      overdue: n < 2 ? 1 : 0,
      stage: e.status === 'Invited' ? 'Yet to Start' : remaining > 6 ? 'In Progress' : 'Pending Verification',
      tasks: ONB_TASKS.map(function (t, ti) {
        return {
          name: t, done: ti < done,
          assignee: /IT|Asset/.test(t) ? id('Sandeep Rao') : /Manager|Department/.test(t) ? byId[e.id].manager : id('Priya Sharma'),
          due: iso(addDays(new Date(e.joined + 'T00:00'), ti + 1)),
          mandatory: ti < 8
        };
      })
    });
  });
  /* Scenario 3: Pranav Hegde is awaiting document verification. */
  var pranav = onboarding.filter(function (o) { return o.employee === id('Pranav Hegde'); })[0];
  if (pranav) { pranav.stage = 'Pending Verification'; pranav.docsPending = 3; }

  var ONB_TEMPLATES = [
    { id: 'tpl-standard', name: 'Standard onboarding', employeeType: 'Full-Time', department: 'All', tasks: ONB_TASKS.length, status: 'Active' },
    { id: 'tpl-intern', name: 'Intern onboarding', employeeType: 'Intern', department: 'All', tasks: 8, status: 'Active' },
    { id: 'tpl-eng', name: 'Engineering onboarding', employeeType: 'Full-Time', department: 'Engineering', tasks: 15, status: 'Active' },
    { id: 'tpl-contract', name: 'Contractor onboarding', employeeType: 'Contract', department: 'All', tasks: 7, status: 'Draft' }
  ];

  /* ------------------------------------------------------------- Offboarding */
  var OFB_TASKS = ['Resignation acknowledged', 'Knowledge transfer plan', 'Handover to successor',
    'Access revocation', 'Asset return', 'Exit interview', 'Final settlement', 'Exit documents'];
  var offboarding = [];
  var ofbSeq = 140;
  employees.filter(function (e) { return e.status === 'Notice Period' || e.status === 'Exited'; }).forEach(function (e) {
    var isExited = e.status === 'Exited';
    var last = addDays(TODAY, isExited ? -(20 + Math.floor(r() * 300)) : 20 + Math.floor(r() * 50));
    var done = isExited ? OFB_TASKS.length : 2 + Math.floor(r() * 3);
    ofbSeq += 1;
    offboarding.push({
      id: 'OFB' + ofbSeq, employee: e.id,
      resignedOn: iso(addDays(last, -60)), resignedOnLabel: pretty(addDays(last, -60)),
      lastWorkingDay: iso(last), lastWorkingDayLabel: pretty(last),
      noticeDays: 60,
      reason: pick(['Better opportunity', 'Higher studies', 'Relocation', 'Personal reasons', 'Career change']),
      stage: isExited ? 'Completed' : 'Notice Period',
      status: isExited ? 'Completed' : 'In Progress',
      tasksTotal: OFB_TASKS.length, tasksDone: done,
      clearance: Math.round((done / OFB_TASKS.length) * 100),
      assetsOutstanding: isExited ? 0 : assets.filter(function (a) { return a.assignedTo === e.id; }).length,
      settlement: isExited ? 'Paid' : 'Pending',
      tasks: OFB_TASKS.map(function (t, ti) { return { name: t, done: ti < done, owner: /Asset|Access/.test(t) ? id('Sandeep Rao') : id('Priya Sharma') }; })
    });
  });
  /* Scenario 13: Aditya Ghosh is the live offboarding case. */
  var aditya = offboarding.filter(function (o) { return o.employee === id('Aditya Ghosh'); })[0];
  if (aditya) {
    aditya.lastWorkingDay = iso(addDays(TODAY, 38));
    aditya.lastWorkingDayLabel = pretty(addDays(TODAY, 38));
    aditya.reason = 'Better opportunity';
    aditya.stage = 'Notice Period';
  }
  /* One resignation is left genuinely awaiting a decision, so the approve and reject
     path in PRD 4.50 is reachable on seed data. The employee stays Active until it is
     approved — approval is what starts the notice period (PRD 5.1). */
  var PENDING_EXIT = id('Imran Qureshi');
  var pendingLast = addDays(TODAY, 62);
  offboarding.push({
    id: 'OFB200', employee: PENDING_EXIT,
    resignedOn: iso(addDays(TODAY, -2)), resignedOnLabel: pretty(addDays(TODAY, -2)),
    lastWorkingDay: iso(pendingLast), lastWorkingDayLabel: pretty(pendingLast),
    noticeDays: 60, reason: 'Higher studies', comments: 'Accepted a place on a full-time masters programme.',
    stage: 'Submitted', status: 'Pending Approval',
    tasksTotal: OFB_TASKS.length, tasksDone: 0, clearance: 0,
    assetsOutstanding: assets.filter(function (a) { return a.assignedTo === PENDING_EXIT; }).length,
    settlement: 'Pending',
    tasks: OFB_TASKS.map(function (t) {
      return { name: t, done: false, owner: /Asset|Access/.test(t) ? id('Sandeep Rao') : id('Priya Sharma') };
    })
  });

  var EXIT_REASONS = ['Better opportunity', 'Higher studies', 'Relocation', 'Personal reasons', 'Career change', 'Retirement'];

  /* ------------------------------------------------------ Documents & policies */
  var POLICIES = [
    { id: 'pol-1', name: 'Employee Handbook', version: 'v4.2', category: 'Handbook', ack: true, published: '2026-07-01', audience: 'All employees' },
    { id: 'pol-2', name: 'Code of Conduct', version: 'v2.0', category: 'Compliance', ack: true, published: '2026-04-12', audience: 'All employees' },
    { id: 'pol-3', name: 'Leave Policy', version: 'v3.1', category: 'HR Policy', ack: true, published: '2026-10-20', audience: 'All employees' },
    { id: 'pol-4', name: 'Attendance & Work Hours Policy', version: 'v2.3', category: 'HR Policy', ack: true, published: '2026-09-02', audience: 'All employees' },
    { id: 'pol-5', name: 'Information Security Policy', version: 'v5.0', category: 'IT', ack: true, published: '2026-10-28', audience: 'All employees', due: '2026-11-15' },
    { id: 'pol-6', name: 'Travel & Expense Policy', version: 'v1.8', category: 'Finance', ack: false, published: '2026-03-15', audience: 'Sales, Operations' },
    { id: 'pol-7', name: 'Remote Work Policy', version: 'v2.1', category: 'HR Policy', ack: true, published: '2026-08-11', audience: 'All employees' },
    { id: 'pol-8', name: 'POSH Policy', version: 'v1.4', category: 'Compliance', ack: true, published: '2026-02-01', audience: 'All employees' },
    { id: 'pol-9', name: 'Acceptable Use of AI Tools', version: 'v1.0', category: 'IT', ack: true, published: '2026-10-05', audience: 'All employees' }
  ];
  /* Acknowledgements: the new security policy is still outstanding for many. */
  var acknowledgements = [];
  POLICIES.filter(function (p) { return p.ack; }).forEach(function (p) {
    var rate = p.id === 'pol-5' ? 0.58 : p.id === 'pol-9' ? 0.81 : 0.97;
    live.filter(function (e) { return e.status !== 'Invited'; }).forEach(function (e) {
      if (r() < rate) acknowledgements.push({ policy: p.id, employee: e.id, on: iso(addDays(new Date(p.published + 'T00:00'), Math.floor(r() * 20))) });
    });
  });

  var DOC_CATEGORIES = ['Identity Proof', 'Address Proof', 'Education Certificate', 'Experience Letter',
    'Employment Agreement', 'Tax Document', 'Bank Proof', 'Other'];

  /* ------------------------------------------------------------------ Payroll */
  var SALARY_COMPONENTS = [
    { id: 'sc-basic', name: 'Basic Salary', kind: 'Earning', calc: '40% of CTC', taxable: true },
    { id: 'sc-hra', name: 'House Rent Allowance', kind: 'Earning', calc: '50% of Basic', taxable: true },
    { id: 'sc-conv', name: 'Conveyance Allowance', kind: 'Earning', calc: 'Flat ₹1,600 / month', taxable: false },
    { id: 'sc-med', name: 'Medical Allowance', kind: 'Earning', calc: 'Flat ₹1,250 / month', taxable: false },
    { id: 'sc-spec', name: 'Special Allowance', kind: 'Earning', calc: 'Balancing component', taxable: true },
    { id: 'sc-pf-er', name: 'Provident Fund — employer', kind: 'Employer Contribution', calc: '12% of Basic', taxable: false },
    { id: 'sc-pf', name: 'Provident Fund', kind: 'Deduction', calc: '12% of Basic', taxable: false },
    { id: 'sc-pt', name: 'Professional Tax', kind: 'Deduction', calc: 'Slab based, by state', taxable: false },
    { id: 'sc-tds', name: 'Tax Deducted at Source', kind: 'Deduction', calc: 'Projected annual tax / 12', taxable: false },
    { id: 'sc-ins', name: 'Group Insurance', kind: 'Deduction', calc: 'Flat ₹450 / month', taxable: false }
  ];
  var SALARY_STRUCTURES = [
    { id: 'ss-ic', name: 'Individual Contributor', levels: '1–4', components: 9, status: 'Active' },
    { id: 'ss-lead', name: 'Lead & Manager', levels: '5–6', components: 10, status: 'Active' },
    { id: 'ss-dir', name: 'Director & above', levels: '7', components: 10, status: 'Active' },
    { id: 'ss-intern', name: 'Intern Stipend', levels: '1', components: 3, status: 'Active' },
    { id: 'ss-contract', name: 'Contractor', levels: 'Any', components: 2, status: 'Active' }
  ];
  function structureFor(e) {
    if (e.type === 'Intern') return 'ss-intern';
    if (e.type === 'Contract' || e.type === 'Consultant') return 'ss-contract';
    return e.level >= 7 ? 'ss-dir' : e.level >= 5 ? 'ss-lead' : 'ss-ic';
  }
  employees.forEach(function (e) { e.salaryStructure = structureFor(e); });

  var payable = live.filter(function (e) { return e.status !== 'Invited'; });
  var payrollCycles = [
    { id: 'pay-2026-11', period: 'November 2026', status: 'Draft', cutoff: '2026-11-25', payDate: '2026-11-30', stage: 'inputs' },
    { id: 'pay-2026-10', period: 'October 2026', status: 'Paid', cutoff: '2026-10-25', payDate: '2026-10-31', stage: 'file' },
    { id: 'pay-2026-09', period: 'September 2026', status: 'Paid', cutoff: '2026-09-25', payDate: '2026-09-30', stage: 'file' },
    { id: 'pay-2026-08', period: 'August 2026', status: 'Paid', cutoff: '2026-08-25', payDate: '2026-08-31', stage: 'file' },
    { id: 'pay-2026-07', period: 'July 2026', status: 'Paid', cutoff: '2026-07-25', payDate: '2026-07-31', stage: 'file' }
  ];
  var monthlyGross = payable.reduce(function (s, e) { return s + e.ctc / 12; }, 0);
  payrollCycles.forEach(function (c, n) {
    var count = payable.length - n * 3;
    var gross = monthlyGross * (count / payable.length);
    c.employees = count;
    c.gross = Math.round(gross);
    c.deductions = Math.round(gross * 0.173);
    c.net = c.gross - c.deductions;
    c.employerCost = Math.round(gross * 1.12);
  });

  /* ----------------------------------------------- Performance & engagement */
  /* `from` and `to` are the review window — when assessments open and close. `starts`
     and `ends` are the period being appraised, which is what the goals run across and
     what says whether somebody is on pace partway through it. */
  var PERF_CYCLES = [
    { id: 'pc-h2-26', name: 'H2 FY2026 Appraisal', period: 'Jul – Dec 2026', starts: '2026-07-01', ends: '2026-12-31', from: '2026-11-15', to: '2026-12-15', status: 'Scheduled', ratingScale: '1 – 5' },
    { id: 'pc-h1-26', name: 'H1 FY2026 Appraisal', period: 'Jan – Jun 2026', starts: '2026-01-01', ends: '2026-06-30', from: '2026-07-01', to: '2026-07-31', status: 'Completed', ratingScale: '1 – 5' },
    { id: 'pc-h2-25', name: 'H2 FY2025 Appraisal', period: 'Jul – Dec 2025', starts: '2025-07-01', ends: '2025-12-31', from: '2026-01-05', to: '2026-02-05', status: 'Completed', ratingScale: '1 – 5' }
  ];
  var perfEligible = live.filter(function (e) { return e.status === 'Active' && e.joined < '2026-08-01'; });
  PERF_CYCLES.forEach(function (c) { c.eligible = perfEligible.length; });
  var COMPETENCIES = ['Ownership', 'Craft & quality', 'Collaboration', 'Communication', 'Customer focus', 'Judgement'];

  /* Scenario 10: Arjun Nair has a pending appraisal in the open cycle. */
  var assessments = shuffle(perfEligible).slice(0, 48).map(function (e, n) {
    return {
      id: 'ASM' + (700 + n), cycle: 'pc-h2-26', employee: e.id, reviewer: e.manager,
      self: n < 12 ? 'Submitted' : 'Not Started',
      manager: n < 5 ? 'Submitted' : 'Not Started',
      status: n < 5 ? 'Manager Review Done' : n < 12 ? 'Awaiting Manager' : 'Awaiting Self-Assessment'
    };
  });
  if (!assessments.some(function (a) { return a.employee === id('Arjun Nair'); })) {
    assessments.unshift({ id: 'ASM699', cycle: 'pc-h2-26', employee: id('Arjun Nair'), reviewer: byName['Arjun Nair'].manager,
      self: 'Not Started', manager: 'Not Started', status: 'Awaiting Self-Assessment' });
  }

  var SURVEYS = [
    { id: 'sv-1', name: 'Q4 Engagement Pulse', type: 'Pulse', anonymous: true, from: '2026-10-30', to: '2026-11-14', status: 'Live', questions: 6 },
    { id: 'sv-2', name: 'Onboarding Experience', type: 'Lifecycle', anonymous: false, from: '2026-10-01', to: '2026-12-31', status: 'Live', questions: 8 },
    { id: 'sv-3', name: 'Annual Engagement Survey 2026', type: 'Engagement', anonymous: true, from: '2026-06-01', to: '2026-06-21', status: 'Closed', questions: 24 },
    { id: 'sv-4', name: 'Return to Office Preferences', type: 'Pulse', anonymous: true, from: '2026-11-15', to: '2026-11-25', status: 'Scheduled', questions: 5 }
  ];
  SURVEYS.forEach(function (s) {
    s.invited = s.id === 'sv-2' ? onbPeople.length + 6 : payable.length;
    s.responded = s.status === 'Scheduled' ? 0
      : s.status === 'Closed' ? Math.round(s.invited * 0.89)
        : s.id === 'sv-2' ? Math.round(s.invited * 0.62) : Math.round(s.invited * 0.57);
  });

  /* ------------------------------------------------------- Admin-side records */
  var SUBSCRIPTION = {
    plan: 'Enterprise', seats: 300, seatsUsed: live.length, cycle: 'Monthly',
    renews: '2026-12-01', renewsLabel: '1 Dec 2026', amount: 234000, currency: 'INR', status: 'Active'
  };
  var SETUP_STEPS = [
    { label: 'Organization profile', done: true }, { label: 'Legal entity', done: true },
    { label: 'Locations & branches', done: true }, { label: 'Work week & holidays', done: true },
    { label: 'Departments & designations', done: true }, { label: 'Roles & permissions', done: true },
    { label: 'Leave & attendance policies', done: true }, { label: 'Payroll configuration', done: false },
    { label: 'Integrations', done: false }, { label: 'Payment method', done: false }
  ];
  var AUDIT = [
    ['Rohit Khanna', 'raised the minimum password length to 12 characters', '2026-10-29T16:12', 'Security'],
    ['Sandeep Rao', 'published Information Security Policy v5.0', '2026-10-28T14:02', 'Configuration'],
    ['Rohit Khanna', 'created the custom role "Payroll Reviewer"', '2026-10-27T10:15', 'Permissions'],
    ['Priya Sharma', 'invited Pranav Hegde to the Engineering team', '2026-10-27T09:40', 'User activity'],
    ['Rohit Khanna', 'connected the Google Workspace calendar integration', '2026-10-22T15:55', 'Configuration'],
    ['Priya Sharma', 'published Leave Policy v3.1', '2026-10-20T11:30', 'Configuration'],
    ['Suresh Babu', 'finalised October 2026 payroll', '2026-10-28T18:40', 'User activity'],
    ['Rohit Khanna', 'suspended one user account', '2026-10-18T12:05', 'Security']
  ].map(function (a, n) {
    return { id: 'AUD' + (5000 + n), actor: id(a[0]), action: a[1], on: a[2], category: a[3] };
  });

  var ANNOUNCEMENTS = [
    { id: 'an-1', title: 'Diwali holidays — 8 and 9 November', body: 'Offices are closed on Sunday 8 and Monday 9 November. The payroll cut-off stays at 25 November.', byName: 'Priya Sharma', on: '2026-10-29', pinned: true },
    { id: 'an-2', title: 'Information Security Policy v5.0 published', body: 'Everyone must acknowledge the updated policy by 15 November.', byName: 'Sandeep Rao', on: '2026-10-28' },
    { id: 'an-3', title: 'H2 performance cycle opens 15 November', body: 'Self-assessments open on 15 November and close on 30 November.', byName: 'Priya Sharma', on: '2026-10-24' },
    { id: 'an-4', title: 'New Bengaluru office floor', body: 'The Bengaluru team moves to the 7th floor from 10 November. Access cards are being reissued.', byName: 'Neha Choudhary', on: '2026-10-20' },
    { id: 'an-5', title: 'Nexora wins Best SaaS Workplace 2026', body: 'Thank you to everyone who took part in the engagement survey that earned us the listing.', byName: 'Rohit Khanna', on: '2026-10-14' }
  ].map(function (a) { return Object.assign({}, a, { by: id(a.byName) }); });

  /* Reactions and comments on announcements (PRD 4.39). One reaction row per person
     per emoji, so a toggle is an add or a remove rather than a counter to keep in step.
     Comments are their own collection for the same reason: a new one is an add, and
     nothing has to rewrite the announcement it hangs off. */
  var ANNOUNCEMENT_REACTIONS = [
    { id: 'ar-1', announcement: 'an-1', byName: 'Ananya Rao', emoji: '🎉' },
    { id: 'ar-2', announcement: 'an-1', byName: 'Vikram Desai', emoji: '🎉' },
    { id: 'ar-3', announcement: 'an-1', byName: 'Sneha Kulkarni', emoji: '👍' },
    { id: 'ar-4', announcement: 'an-1', byName: 'Rahul Verma', emoji: '❤️' },
    { id: 'ar-5', announcement: 'an-3', byName: 'Ananya Rao', emoji: '👍' },
    { id: 'ar-6', announcement: 'an-4', byName: 'Pooja Agarwal', emoji: '👍' },
    { id: 'ar-7', announcement: 'an-5', byName: 'Ananya Rao', emoji: '👏' },
    { id: 'ar-8', announcement: 'an-5', byName: 'Sneha Kulkarni', emoji: '👏' },
    { id: 'ar-9', announcement: 'an-5', byName: 'Vikram Desai', emoji: '🎉' },
    { id: 'ar-10', announcement: 'an-5', byName: 'Rahul Verma', emoji: '👏' }
  ].map(function (r) { return Object.assign({}, r, { employee: id(r.byName) }); });

  var ANNOUNCEMENT_COMMENTS = [
    { id: 'ac-1', announcement: 'an-1', byName: 'Ananya Rao', body: 'Does the Bengaluru office follow the same two days?', on: '2026-10-29T11:20' },
    { id: 'ac-2', announcement: 'an-1', byName: 'Priya Sharma', body: 'Yes — all three locations are closed on both days.', on: '2026-10-29T12:05' },
    { id: 'ac-3', announcement: 'an-4', byName: 'Pooja Agarwal', body: 'Will the access cards be handed out at the desk or by post?', on: '2026-10-21T09:40' },
    { id: 'ac-4', announcement: 'an-5', byName: 'Vikram Desai', body: 'Well deserved. Congratulations everyone.', on: '2026-10-14T18:12' }
  ].map(function (c) { return Object.assign({}, c, { by: id(c.byName) }); });

  /* ------------------------------------------------------- Approval requests
     Built from the pending records above, so the inbox count always agrees with
     the module counts (PRD 15: calculated, not hardcoded). */
  var approvals = [];
  leaveRequests.filter(function (l) { return l.status === 'Pending Approval'; }).forEach(function (l) {
    var t = LEAVE_TYPES.filter(function (x) { return x.id === l.type; })[0];
    approvals.push({
      id: l.id, kind: 'Leave Request', module: 'leave', employee: l.employee,
      detail: t.name + ' · ' + l.days + ' day' + (l.days > 1 ? 's' : '') + ' from ' + l.fromLabel,
      submitted: l.appliedOn, approver: l.approver, status: 'Pending Approval', route: 'hr/leave/requests'
    });
  });
  regularizations.filter(function (x) { return x.status === 'Pending Approval'; }).forEach(function (x) {
    approvals.push({
      id: x.id, kind: 'Attendance Regularization', module: 'attendance', employee: x.employee,
      detail: x.issue + ' on ' + x.dateLabel, submitted: x.date, approver: x.approver,
      status: 'Pending Approval', route: 'hr/attendance/regularization'
    });
  });
  assetRequests.filter(function (a) { return a.status === 'Pending Approval'; }).forEach(function (a) {
    approvals.push({
      id: a.id, kind: 'Asset Request', module: 'assets', employee: a.employee,
      detail: a.category + ' — ' + a.reason, submitted: a.requestedOn, approver: a.approver,
      status: 'Pending Approval', route: 'hr/assets/requests'
    });
  });
  approvals.push(
    { id: 'PC9501', kind: 'Profile Change', module: 'people', employee: id('Pooja Agarwal'),
      detail: 'Bank account details updated', submitted: '2026-10-31', approver: id('Priya Sharma'), status: 'Pending Approval', route: 'hr/people/all' },
    /* The id must be the offboarding case's own, since decideApproval looks the case
       up by it to start the notice period. */
    { id: 'OFB200', kind: 'Resignation', module: 'offboarding', employee: PENDING_EXIT,
      detail: 'Last working day ' + pretty(pendingLast), submitted: iso(addDays(TODAY, -2)),
      approver: id('Priya Sharma'), status: 'Pending Approval', route: 'hr/offboarding/resignations' },
    { id: 'DV9503', kind: 'Document Verification', module: 'onboarding', employee: id('Pranav Hegde'),
      detail: '3 documents awaiting verification', submitted: '2026-11-02', approver: id('Meera Iyer'), status: 'Pending Approval', route: 'hr/onboarding/verification' },
    { id: 'SW9504', kind: 'Shift Swap', module: 'shifts', employee: id('Ravi Shankar'),
      detail: 'Morning to evening on 12 Nov 2026', submitted: '2026-11-01', approver: id('Neha Choudhary'), status: 'Pending Approval', route: 'hr/shifts/swaps' }
  );

  /* -------------------------------------------------------------- Celebrations */
  function daysTo(mmdd) {
    var d = new Date(TODAY.getFullYear(), Number(mmdd.slice(0, 2)) - 1, Number(mmdd.slice(3)));
    if (d < TODAY) d = new Date(TODAY.getFullYear() + 1, d.getMonth(), d.getDate());
    return Math.round((d - TODAY) / 86400000);
  }
  var birthdays = live.map(function (e) { return { employee: e.id, on: e.dob.slice(5), inDays: daysTo(e.dob.slice(5)) }; })
    .filter(function (b) { return b.inDays <= 14; }).sort(function (a, b) { return a.inDays - b.inDays; });
  var anniversaries = live.map(function (e) {
    return { employee: e.id, on: e.joined.slice(5), inDays: daysTo(e.joined.slice(5)), years: TODAY.getFullYear() - Number(e.joined.slice(0, 4)) };
  }).filter(function (a) { return a.inDays <= 14 && a.years > 0; }).sort(function (a, b) { return a.inDays - b.inDays; });

  /* ------------------------------------------------------------ Notifications */
  var notifications = [
    { id: 'n1', kind: 'Leave Request', title: 'Sneha Kulkarni applied for Sick Leave', body: '2 days from 4 Nov 2026 · awaiting your approval', on: '2026-11-03T09:12', read: false, route: 'hr/leave/requests', roles: ['hr'] },
    { id: 'n2', kind: 'Policy Acknowledgement', title: 'Information Security Policy v5.0 needs your acknowledgement', body: 'Due 15 Nov 2026', on: '2026-11-03T08:40', read: false, route: 'me/documents/acknowledgements', roles: ['me'] },
    { id: 'n3', kind: 'Payroll', title: 'November payroll is open for review', body: payable.length + ' employees · cut-off 25 Nov 2026', on: '2026-11-02T17:05', read: false, route: 'hr/payroll/cycles', roles: ['hr'] },
    { id: 'n4', kind: 'Onboarding Reminder', title: 'Pranav Hegde has 3 documents awaiting verification', body: 'Document verification is blocking IT setup', on: '2026-11-02T11:20', read: false, route: 'hr/onboarding/verification', roles: ['hr'] },
    { id: 'n5', kind: 'Attendance Exception', title: '6 missing punches today', body: 'Including Vikram Desai, who has raised a correction', on: '2026-11-03T09:00', read: false, route: 'hr/attendance/regularization', roles: ['hr'] },
    { id: 'n6', kind: 'Asset Request', title: '7 asset requests awaiting approval', body: 'Oldest raised 20 days ago', on: '2026-11-01T10:10', read: true, route: 'hr/assets/requests', roles: ['hr'] },
    { id: 'n7', kind: 'Invitation', title: '2 invitations are still unaccepted', body: 'Sent more than 5 days ago', on: '2026-10-30T14:30', read: true, route: 'admin/users/pending', roles: ['admin', 'hr'] },
    { id: 'n8', kind: 'Payslip Published', title: 'Your October 2026 payslip is ready', body: 'Net pay credited on 31 Oct 2026', on: '2026-10-31T18:00', read: true, route: 'me/payroll/payslips', roles: ['me'] },
    { id: 'n9', kind: 'Survey Invitation', title: 'Q4 engagement pulse is open', body: '6 questions · closes 14 Nov 2026', on: '2026-10-30T10:00', read: false, route: 'me/engagement/surveys', roles: ['me'] },
    { id: 'n10', kind: 'Performance Review', title: 'H2 FY2026 self-assessment opens 15 November', body: 'Closes 30 November', on: '2026-10-24T09:30', read: true, route: 'me/performance/self', roles: ['me'] },
    { id: 'n11', kind: 'Security Event', title: 'Password policy changed', body: 'Minimum length raised to 12 characters by Rohit Khanna', on: '2026-10-29T16:12', read: true, route: 'admin/audit/security', roles: ['admin'] },
    { id: 'n12', kind: 'Subscription', title: 'Seat usage at ' + Math.round((live.length / SUBSCRIPTION.seats) * 100) + '%', body: live.length + ' of ' + SUBSCRIPTION.seats + ' seats used', on: '2026-10-28T09:00', read: true, route: 'admin/billing/billing', roles: ['admin'] },
    { id: 'n13', kind: 'Resignation Request', title: 'Aditya Ghosh has submitted a resignation', body: 'Awaiting HR decision', on: '2026-10-12T15:20', read: true, route: 'hr/offboarding/resignations', roles: ['hr'] }
  ];

  /* ------------------------------------------------- Shift roster (PRD 4.21)
     The published roster for the current week. Weekends are left unassigned. */
  var shiftAssignments = [];
  var saSeq = 0;
  var weekStart = addDays(TODAY, -((TODAY.getDay() + 6) % 7));        // Monday of this week
  live.filter(function (e) { return e.status !== 'Invited'; }).forEach(function (e) {
    for (var d = 0; d < 7; d++) {
      var day = addDays(weekStart, d);
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      saSeq += 1;
      shiftAssignments.push({
        id: 'SA' + (10000 + saSeq), employee: e.id, date: iso(day), shift: e.shift,
        published: true, source: 'Roster'
      });
    }
  });
  var shiftSwaps = [
    { id: 'SW9504', employee: id('Ravi Shankar'), with: id('Mohan Das'), date: iso(addDays(TODAY, 9)),
      from: 'sh-mor', to: 'sh-eve', reason: 'Medical appointment that morning',
      counterpartyAgreed: true, status: 'Pending Approval', approver: id('Neha Choudhary') },
    { id: 'SW9505', employee: id('Varun Kapoor'), with: id('Aisha Begum'), date: iso(addDays(TODAY, -6)),
      from: 'sh-gen', to: 'sh-eve', reason: 'Family commitment',
      counterpartyAgreed: true, status: 'Approved', approver: id('Karthik Menon') }
  ];

  /* ------------------------------------------- Employee documents (PRD 4.24) */
  var employeeDocuments = [];
  var edSeq = 0;
  var REQUIRED_DOCS = ['Identity Proof', 'Address Proof', 'Education Certificate', 'Employment Agreement'];
  live.filter(function (e) { return e.status !== 'Invited'; }).forEach(function (e) {
    var isNew = e.status === 'Onboarding';
    REQUIRED_DOCS.forEach(function (cat, n) {
      edSeq += 1;
      var verified = isNew ? n === 0 : r() < 0.94;
      employeeDocuments.push({
        id: 'DOC' + (20000 + edSeq), employee: e.id, category: cat,
        name: cat.replace(/ /g, '_') + '_' + e.id + '.pdf',
        uploaded: iso(addDays(new Date(e.joined + 'T00:00'), Math.floor(r() * 5))),
        status: verified ? 'Verified' : 'Pending Verification',
        verifiedBy: verified ? id('Meera Iyer') : null,
        expiry: cat === 'Identity Proof' ? iso(addDays(TODAY, 300 + Math.floor(r() * 1400))) : null,
        size: (40 + Math.floor(r() * 2400)) + ' KB'
      });
    });
    if (r() < 0.35) {
      edSeq += 1;
      employeeDocuments.push({
        id: 'DOC' + (20000 + edSeq), employee: e.id, category: 'Experience Letter',
        name: 'Experience_' + e.id + '.pdf', uploaded: e.joined, status: 'Verified',
        verifiedBy: id('Meera Iyer'), expiry: null, size: (60 + Math.floor(r() * 400)) + ' KB'
      });
    }
  });

  /* ------------------------------------------------------- Payslips (PRD 4.38) */
  function breakdown(ctc) {
    var monthly = ctc / 12;
    var basic = Math.round(monthly * 0.4);
    var hra = Math.round(basic * 0.5);
    var conv = 1600, med = 1250;
    var special = Math.round(monthly - basic - hra - conv - med);
    var pf = Math.round(basic * 0.12);
    var pt = monthly > 50000 ? 200 : 150;
    var ins = 450;
    var gross = basic + hra + conv + med + special;
    var tds = Math.round(Math.max(0, (ctc - 300000)) * 0.1 / 12);
    var deductions = pf + pt + ins + tds;
    return {
      earnings: [['Basic Salary', basic], ['House Rent Allowance', hra], ['Conveyance Allowance', conv],
        ['Medical Allowance', med], ['Special Allowance', special]],
      deductions: [['Provident Fund', pf], ['Professional Tax', pt], ['Group Insurance', ins], ['Tax Deducted at Source', tds]],
      gross: gross, totalDeductions: deductions, net: gross - deductions,
      employerPf: pf
    };
  }
  employees.forEach(function (e) { e.breakdown = breakdown(e.ctc); });

  var payslips = [];
  var psSeq = 0;
  payrollCycles.filter(function (c) { return c.status === 'Paid'; }).forEach(function (cycle) {
    payable.forEach(function (e) {
      if (e.joined > cycle.payDate) return;
      psSeq += 1;
      var b = e.breakdown;
      payslips.push({
        id: 'PS' + (30000 + psSeq), cycle: cycle.id, period: cycle.period, employee: e.id,
        gross: b.gross, deductions: b.totalDeductions, net: b.net,
        paidOn: cycle.payDate, status: 'Published', lopDays: 0
      });
    });
  });

  /* --------------------------------------------------- Tax declarations (4.37) */
  var taxDeclarations = payable.filter(function (e) { return e.type === 'Full-Time'; }).map(function (e, n) {
    var submitted = r() < 0.62;
    return {
      id: 'TD' + (40000 + n), employee: e.id, year: 'FY 2026-27', regime: r() < 0.55 ? 'New' : 'Old',
      declared: submitted ? Math.round((50000 + r() * 150000) / 1000) * 1000 : 0,
      proofs: submitted ? Math.floor(1 + r() * 4) : 0,
      status: submitted ? (r() < 0.6 ? 'Verified' : 'Pending Verification') : 'Not Started',
      submittedOn: submitted ? iso(addDays(TODAY, -Math.floor(r() * 90))) : null
    };
  });

  /* ---------------------------------------------------------- Goals (PRD 4.46) */
  var GOAL_TEMPLATES = {
    'dep-eng': ['Cut p95 API latency by 30%', 'Ship the multi-region failover', 'Raise unit test coverage to 80%', 'Close the top 20 reliability bugs'],
    'dep-prd': ['Launch the reporting module', 'Run 12 customer discovery calls a quarter', 'Reduce time-to-first-value to 7 days', 'Define the FY27 roadmap'],
    'dep-dsg': ['Ship the design system v3', 'Raise task success rate to 90%', 'Run quarterly usability studies', 'Cut design-to-dev handoff time'],
    'dep-hr': ['Reduce time-to-hire to 30 days', 'Lift engagement score to 4.2', 'Complete the appraisal cycle on time', 'Roll out the new onboarding template'],
    'dep-fin': ['Close books within 5 working days', 'Automate payroll reconciliation', 'Reduce receivable days to 45', 'Pass the statutory audit clean'],
    'dep-mkt': ['Grow organic traffic 40%', 'Deliver 600 qualified leads', 'Launch the customer story series', 'Cut cost per lead by 20%'],
    'dep-sal': ['Achieve ₹4.2 Cr new ARR', 'Lift win rate to 28%', 'Build 3x pipeline coverage', 'Expand 15 existing accounts'],
    'dep-ops': ['Keep uptime above 99.95%', 'Close the SOC 2 Type II audit', 'Reduce onboarding setup time by half', 'Cut vendor spend 15%']
  };
  var goals = [];
  var gSeq = 0;
  perfEligible.forEach(function (e) {
    var pool = GOAL_TEMPLATES[e.department] || GOAL_TEMPLATES['dep-ops'];
    var n = 2 + Math.floor(r() * 3);
    for (var g = 0; g < n; g++) {
      gSeq += 1;
      /* Goal progress is not uniform in a real cycle. Most goals are well along by
         November, a fifth are finished, and a few never started — a flat 0-100 random
         put only 1 goal in 100 at Achieved, which made every completion rate read as
         a failure. */
      var roll = r(), progress;
      if (roll < 0.22) progress = 100;
      else if (roll < 0.68) progress = 60 + Math.floor(r() * 36);
      else if (roll < 0.92) progress = 20 + Math.floor(r() * 40);
      else progress = 0;
      goals.push({
        id: 'GL' + (50000 + gSeq), employee: e.id, cycle: 'pc-h2-26',
        title: pool[g % pool.length], weight: 0,
        progress: progress,
        status: progress === 100 ? 'Achieved' : progress > 0 ? 'In Progress' : 'Not Started',
        due: '2026-12-31'
      });
    }
  });
  /* Weights are normalised per employee so each set sums to 100. */
  var byEmpGoals = {};
  goals.forEach(function (g) { (byEmpGoals[g.employee] = byEmpGoals[g.employee] || []).push(g); });
  Object.keys(byEmpGoals).forEach(function (k) {
    var set = byEmpGoals[k];
    var each = Math.floor(100 / set.length);
    set.forEach(function (g, i) { g.weight = i === set.length - 1 ? 100 - each * (set.length - 1) : each; });
  });

  /* ------------------------------------------------- Survey responses (PRD 4.41) */
  var SURVEY_QUESTIONS = [
    { id: 'q1', text: 'I understand how my work contributes to the company goals', kind: 'Rating Scale' },
    { id: 'q2', text: 'I get the support I need from my manager', kind: 'Rating Scale' },
    { id: 'q3', text: 'I would recommend Nexora as a place to work', kind: 'NPS' },
    { id: 'q4', text: 'I have the tools I need to do my job well', kind: 'Rating Scale' },
    { id: 'q5', text: 'My workload is sustainable', kind: 'Rating Scale' },
    { id: 'q6', text: 'What would you change first?', kind: 'Text Response' }
  ];
  var surveyResponses = [];
  var srSeq = 0;
  SURVEYS.forEach(function (sv) {
    for (var n = 0; n < sv.responded; n++) {
      srSeq += 1;
      var person = eligible[Math.floor(r() * eligible.length)];
      surveyResponses.push({
        id: 'SR' + (60000 + srSeq), survey: sv.id,
        employee: sv.anonymous ? null : person.id,
        department: sv.anonymous ? person.department : person.department,
        submittedOn: iso(addDays(new Date(sv.from + 'T00:00'), Math.floor(r() * 10))),
        scores: { q1: 3 + Math.floor(r() * 3), q2: 3 + Math.floor(r() * 3), q3: 6 + Math.floor(r() * 5), q4: 3 + Math.floor(r() * 3), q5: 2 + Math.floor(r() * 4) }
      });
    }
  });

  /* ------------------------------------------- Feedback & recognition (PRD 4.42) */
  var RECOGNITION_VALUES = ['Ownership', 'Craft', 'Teamwork', 'Customer first'];
  var recognition = [];
  /* Two dozen recognitions across 262 people is one a fortnight for the whole
     company, which no recognition feature would survive. At this volume a little
     over half of everyone has been recognised at least once in two months, which is
     what moderate uptake looks like — and it gives the teamwork dimension of the
     performance score something to read. */
  for (i = 0; i < 240; i++) {
    var to = eligible[Math.floor(r() * eligible.length)];
    var from = eligible[Math.floor(r() * eligible.length)];
    if (to.id === from.id) continue;
    recognition.push({
      id: 'RC' + (70000 + i), to: to.id, from: from.id,
      value: pick(RECOGNITION_VALUES),
      note: pick(['Stepped in during the release weekend and kept everyone calm.',
        'Rewrote the onboarding guide without being asked. Huge difference.',
        'Caught a billing bug before it reached customers.',
        'Mentored two new joiners through their first month.',
        'Turned a difficult customer call into a renewal.']),
      on: iso(addDays(TODAY, -Math.floor(r() * 60)))
    });
  }
  var feedback = [];
  for (i = 0; i < 14; i++) {
    feedback.push({
      id: 'FB' + (80000 + i), employee: r() < 0.4 ? null : eligible[Math.floor(r() * eligible.length)].id,
      category: pick(['Workplace', 'Tools', 'Process', 'Management', 'Benefits']),
      note: pick(['Meeting rooms are hard to book on Tuesdays.',
        'The VPN drops during the evening shift.',
        'Sprint planning runs long; could we split it?',
        'More clarity on the promotion criteria would help.',
        'The Pune cafeteria options are limited.']),
      on: iso(addDays(TODAY, -Math.floor(r() * 45))),
      status: pick(['Open', 'Open', 'Under Review', 'Actioned'])
    });
  }
  var ACTION_PLANS = [
    { id: 'AP1', survey: 'sv-3', title: 'Clarify career progression', owner: id('Priya Sharma'), due: '2026-12-15', status: 'In Progress', finding: 'Only 61% agreed that progression is clear' },
    { id: 'AP2', survey: 'sv-3', title: 'Fix evening-shift VPN stability', owner: id('Sandeep Rao'), due: '2026-11-30', status: 'In Progress', finding: 'Raised in 14 free-text responses' },
    { id: 'AP3', survey: 'sv-3', title: 'Review meeting load in Engineering', owner: id('Karthik Menon'), due: '2026-11-20', status: 'Completed', finding: 'Workload sustainability scored lowest in Engineering' }
  ];

  /* ------------------------------------------------- Users & invitations (2.1) */
  var users = live.map(function (e) {
    var role = e.id === id('Rohit Khanna') ? 'admin'
      : e.department === 'dep-hr' && e.level >= 4 ? 'hr'
        : e.level >= 5 ? 'manager' : 'me';
    return {
      id: 'USR' + e.id.slice(3), employee: e.id, email: e.workEmail, role: role,
      status: e.status === 'Invited' ? 'Pending Invitation' : e.status === 'Suspended' ? 'Suspended' : 'Active',
      lastSignIn: e.status === 'Invited' ? null : iso(addDays(TODAY, -Math.floor(r() * 9))),
      mfa: r() < 0.38, invitedOn: e.joined
    };
  });

  /* Integrations. Three providers for now, and the screen is a plain grid of cards
     rather than tabs or sections: one page, one look, nothing to click through before
     you can see what is connected.

     `scope` is the regions line under the name, `connectedOn` the date the footer
     shows when a provider is connected, and `note` an optional caution the card prints
     above its footer.

     `fields` drives the configuration form a card opens, so adding a provider later is
     a data change rather than a screen change. */
  var INTEGRATIONS = [
    {
      id: 'int-outlook',
      name: 'Microsoft Outlook',
      provider: 'Microsoft 365',
      scope: 'India · GCC · Global',
      kind: 'Mail and calendar',
      status: 'Connected',
      connectedOn: '2026-10-12',
      detail: 'notifications@nexoratech.com',
      summary: 'Sends HRMS notifications from your Microsoft 365 tenant, and writes approved leave, '
        + 'holidays and interview invitations to employee calendars.',
      logo: { text: 'O', bg: '#eaf2fd', fg: '#0f6cbd' },
      capabilities: ['Outbound notification email', 'Leave and holidays on calendars', 'Interview invitations'],
      lastSync: '2026-11-04T05:40:00',
      fields: [
        { id: 'tenant', kind: 'text', label: 'Microsoft 365 tenant', value: 'nexoratech.onmicrosoft.com',
          hint: 'The directory the HRMS authenticates against.' },
        { id: 'sender', kind: 'text', label: 'Sender address', value: 'notifications@nexoratech.com',
          hint: 'Every notification the HRMS sends comes from here.' },
        { id: 'calendar', kind: 'select', label: 'Write leave to', value: 'employee',
          options: [
            { value: 'employee', label: 'The employee’s own calendar' },
            { value: 'shared', label: 'A shared HR calendar' },
            { value: 'both', label: 'Both' }
          ] },
        { id: 'invites', kind: 'switch', label: 'Send interview invitations as calendar invites', value: true },
        { id: 'busy', kind: 'switch', label: 'Mark approved leave as Out of office', value: true }
      ]
    },
    {
      id: 'int-tracklivo',
      name: 'Tracklivo',
      provider: 'Tracklivo',
      scope: 'India · GCC',
      kind: 'Project management',
      status: 'Connected',
      connectedOn: '2026-09-28',
      detail: '3 sites · synced every 15 minutes',
      summary: 'Project and task management for delivery teams. Pulls projects, assignments and '
        + 'worked hours into the HRMS so timesheets and payroll read the same numbers.',
      logo: { text: 'T', bg: '#efeafd', fg: '#5733c1' },
      capabilities: ['Projects and task assignments', 'Worked-hours sync', 'Overtime hours into payroll'],
      lastSync: '2026-11-04T05:30:00',
      fields: [
        { id: 'workspace', kind: 'text', label: 'Tracklivo workspace', value: 'nexoratech',
          hint: 'The workspace these projects report into.' },
        { id: 'key', kind: 'text', label: 'API key', value: 'tl_live_4f21…c90a', secret: true,
          hint: 'Rotated from Tracklivo. Only the last four characters are shown.' },
        { id: 'every', kind: 'select', label: 'Sync every', value: '15',
          options: [
            { value: '15', label: '15 minutes' },
            { value: '60', label: 'Hour' },
            { value: 'day', label: 'Day, after midnight' }
          ] },
        { id: 'overtime', kind: 'switch', label: 'Send approved overtime to payroll', value: true },
        { id: 'auto', kind: 'switch', label: 'Raise a regularisation when a punch is missing', value: false }
      ]
    },
    {
      id: 'int-access',
      name: 'Biometric & access card',
      provider: 'Device gateway',
      scope: 'India · GCC',
      kind: 'Attendance devices',
      status: 'Not connected',
      connectedOn: null,
      detail: 'Fingerprint, face and RFID readers',
      summary: 'Reads punches from fingerprint, face and access-card readers at your sites, so '
        + 'attendance and regularisation follow the door rather than a manual entry.',
      note: 'Needs a reachable device gateway on each site network.',
      logo: { text: 'B', bg: '#eafaf1', fg: '#0f7b53' },
      capabilities: ['Fingerprint and face punches', 'Access-card swipes', 'Door-level entry and exit'],
      lastSync: null,
      fields: [
        { id: 'gateway', kind: 'text', label: 'Gateway address', value: '',
          hint: 'Host and port of the on-site device gateway, e.g. 10.4.2.18:9100.' },
        { id: 'token', kind: 'text', label: 'Device token', value: '', secret: true,
          hint: 'Issued by the gateway. Pairs the readers with this tenant.' },
        { id: 'mode', kind: 'select', label: 'Record punches from', value: 'both',
          options: [
            { value: 'bio', label: 'Biometric readers only' },
            { value: 'card', label: 'Access cards only' },
            { value: 'both', label: 'Biometric readers and access cards' }
          ] },
        { id: 'doors', kind: 'switch', label: 'Treat the first swipe of the day as clock-in', value: true },
        { id: 'missing', kind: 'switch', label: 'Raise a regularisation when an exit swipe is missing', value: true }
      ]
    }
  ];

  /* ------------------------------------------------- Billing and usage (PRD 2.1)

     The subscription is per seat, per month, and the plan carries a monthly AI credit
     allowance that resets with it. Those two facts are what the Billing and usage
     screen is built on: seats you pay for against seats in use, and credits you are
     given against credits you have spent.

     Credits bought on top never expire and are only drawn on once the monthly
     allowance runs out, which is why they are tracked separately from the allowance.

     `creditMonths` is the usage history the Usage tab charts. Each month carries its
     daily running total (for the trend), its split by category (for the breakdown)
     and what, if anything, had to be bought when the allowance ran out. */

  var BILLING_PLANS = [
    { key: 'growth', name: 'Growth', price: 520, credits: 25000,
      for: 'A single entity getting off spreadsheets',
      has: ['Core HR, leave and attendance', 'Payroll for one entity', 'Email support'] },
    { key: 'enterprise', name: 'Enterprise', price: 780, credits: 80000,
      for: 'Several entities and a full HR function',
      has: ['Everything in Growth', 'Performance and engagement', 'SSO and audit logs', 'Priority support'] },
    { key: 'scale', name: 'Scale', price: 980, credits: 200000,
      for: 'Multi-entity payroll and heavier automation',
      has: ['Everything in Enterprise', 'Multi-entity payroll', 'Custom workflows', 'A dedicated success manager'] }
  ];

  var BILLING_CARDS = [
    { id: 'c1', brand: 'Visa', last: '4417', exp: '08 / 29', name: 'Nexora Technologies Pvt Ltd', def: true },
    { id: 'c2', brand: 'Mastercard', last: '7701', exp: '02 / 28', name: 'Rohit Khanna', def: false }
  ];

  var BILLING_PAYMENTS = [
    { d: '02 Nov 2026', what: 'AI credits', note: '20,000 credit top-up', amt: 9000, how: 'Visa ••4417', st: 'Paid' },
    { d: '01 Nov 2026', what: 'Subscription', note: 'Enterprise · 300 seats · Nov', amt: 234000, how: 'Visa ••4417', st: 'Paid' },
    { d: '18 Oct 2026', what: 'Seats', note: '10 seats added · pro-rata to 31 Oct', amt: 3271, how: 'Visa ••4417', st: 'Paid' },
    { d: '01 Oct 2026', what: 'Subscription', note: 'Enterprise · 290 seats · Oct', amt: 226200, how: 'Visa ••4417', st: 'Paid' },
    { d: '24 Sep 2026', what: 'AI credits', note: '5,000 credit top-up', amt: 2400, how: 'Mastercard ••7701', st: 'Paid' }
  ];

  /* What the credits were spent on. The descriptions matter on the screen: "Resume
     parsing" alone does not tell an admin why it cost 8,450 credits this month. */
  var CREDIT_CATEGORIES = [
    ['Resume parsing', 'Candidate CVs read into onboarding'],
    ['Policy question answering', 'Questions people asked about leave and policy'],
    ['Attendance anomaly detection', 'Punches checked against the roster'],
    ['Appraisal summary drafting', 'Review notes turned into a first draft'],
    ['Survey theme extraction', 'Open-ended engagement answers grouped']
  ];
  var CREDIT_COLORS = ['#5733c1', '#2f7ae5', '#1f7a6e', '#c2741a', '#b4249e'];

  /* A plausible daily shape for a past month: weekends light, everything scaled so the
     days add up to the month's total. Seeded so the chart is the same on every load. */
  function creditDays(n, total, seed) {
    var a = [], s = seed, i;
    for (i = 0; i < n; i++) {
      s = (s * 9301 + 49297) % 233280;
      var weekend = (i % 7 === 5 || i % 7 === 6) ? 0.25 : 1;
      a.push(weekend * (0.6 + (s / 233280) * 0.8));
    }
    var sum = a.reduce(function (x, y) { return x + y; }, 0);
    return a.map(function (v) { return Math.round((v / sum) * total / 5) * 5; });
  }

  var CREDIT_MONTHS = [
    { k: 'November 2026', live: true, daily: [8120, 7640, 8310],
      cats: [8450, 6120, 4380, 3220, 1900], extra: 0, spentOnTopups: 0 },
    { k: 'October 2026', daily: creditDays(31, 88400, 31),
      cats: [31200, 22400, 15600, 12300, 6900], extra: 12000, spentOnTopups: 5400 },
    { k: 'September 2026', daily: creditDays(30, 61500, 7),
      cats: [21800, 15600, 10900, 8700, 4500], extra: 0, spentOnTopups: 0 }
  ];

  /* The day the allowance ran out, read off the same daily series the trend chart
     draws, so the sentence under the figure and the marker on the chart can never
     name two different days. */
  CREDIT_MONTHS.forEach(function (m) {
    var limit = BILLING_PLANS.filter(function (p) { return p.key === 'enterprise'; })[0].credits;
    var run = 0, day = null;
    m.daily.forEach(function (n, i) {
      run += n;
      if (day === null && run >= limit) day = i + 1;
    });
    m.ranOut = m.live ? null : day;
  });

  /* Bought credits get cheaper per 1,000 the more you take at once. The Usage tab's buy
     dialog reads these, so the tiers, the quote and the "add a little more and save"
     nudge can never disagree with each other. */
  var CREDIT_TIERS = [
    { min: 1000, per: 500, save: 0 },
    { min: 5000, per: 480, save: 4 },
    { min: 20000, per: 450, save: 10 },
    { min: 50000, per: 400, save: 20 }
  ];

  var BILLING = {
    plan: 'enterprise', seats: 300, renews: '2026-12-01', renewsLabel: '1 Dec 2026',
    perDay: 8023,
    plans: BILLING_PLANS, cards: BILLING_CARDS, payments: BILLING_PAYMENTS,
    months: CREDIT_MONTHS, categories: CREDIT_CATEGORIES, colors: CREDIT_COLORS,
    tiers: CREDIT_TIERS
  };

  /* The admin dashboard shows one AI card, and it must agree with the Usage tab: same
     allowance, same spend, same split. So it is derived here rather than written out
     a second time. */
  var AI_USAGE = (function () {
    var plan = BILLING_PLANS.filter(function (p) { return p.key === BILLING.plan; })[0];
    var liveMonth = CREDIT_MONTHS[0];
    return {
      credits: plan.credits,
      used: liveMonth.cats.reduce(function (a, n) { return a + n; }, 0),
      byModule: CREDIT_CATEGORIES.map(function (c, i) {
        return { module: c[0], credits: liveMonth.cats[i] };
      })
    };
  }());

  /* --------------------------------------------- Payroll inputs (PRD 4.33–4.38)
     The one-off amounts a cycle carries, which is most of what makes one month's
     payroll differ from the last: money people have spent and want back, a revision
     that landed mid-month and owes arrears, and instalments on what they have
     borrowed. The arithmetic that turns these into a payslip lives in js/payroll.js —
     these are the records it reads. */
  var REIMBURSEMENT_KINDS = [
    { kind: 'Travel', cap: 25000, note: 'Flights, trains, cabs and hotels on company work.' },
    { kind: 'Internet', cap: 1500, note: 'Home broadband, against a monthly bill.' },
    { kind: 'Meals', cap: 4000, note: 'Client meals and working meals, with the receipt.' },
    { kind: 'Learning', cap: 30000, note: 'Courses, books, certifications and conference tickets.' },
    { kind: 'Equipment', cap: 15000, note: 'Chairs, desks and peripherals for a home setup.' },
    { kind: 'Relocation', cap: 80000, note: 'Moving costs, agreed before the move.' }
  ];
  var reimbursements = [];
  shuffle(payable).slice(0, 64).forEach(function (e, n) {
    var k = REIMBURSEMENT_KINDS[n % REIMBURSEMENT_KINDS.length];
    var raised = addDays(TODAY, -(2 + Math.floor(r() * 70)));
    var status = n < 26 ? 'Approved' : n < 44 ? 'Awaiting approval' : n < 56 ? 'Paid' : 'Declined';
    reimbursements.push({
      id: 'RB' + (90000 + n), employee: e.id, kind: k.kind,
      amount: Math.round((k.cap * (0.15 + r() * 0.7)) / 50) * 50,
      on: iso(raised), claimed: iso(raised),
      status: status,
      paidIn: status === 'Paid' ? 'pay-2026-10' : null,
      receipt: r() < 0.88, approver: e.manager,
      note: status === 'Declined' ? 'No receipt attached. Raise it again with one.' : null
    });
  });

  /* Revisions that have already taken effect. One lands inside the open cycle and
     owes a month of arrears, which is the case a payroll reviewer has to catch. */
  var salaryRevisions = [];
  shuffle(live.filter(function (e) { return e.status === 'Active'; })).slice(0, 18).forEach(function (e, n) {
    var pctUp = 0.06 + r() * 0.16;
    var effective = n < 4 ? '2026-11-01' : iso(addDays(TODAY, -(40 + Math.floor(r() * 260))));
    var from = Math.round(e.ctc / (1 + pctUp) / 1000) * 1000;
    salaryRevisions.push({
      id: 'SR' + (95000 + n), employee: e.id, from: from, to: e.ctc,
      pct: Math.round(pctUp * 1000) / 10, effective: effective,
      reason: pick(['Annual review', 'Promotion', 'Market correction', 'Retention']),
      /* A revision effective on the first of the open month is being paid for the
         first time in it, so it carries no arrears; one backdated does. */
      arrears: n < 4 ? 0 : (n < 9 ? Math.round((e.ctc - from) / 12) : 0),
      approvedBy: id('Priya Sharma')
    });
  });

  /* The self-service persona is who the Employee workspace is seen through, so they
     carry one of everything their own screens can show: a claim waiting, a claim
     approved and riding the next cycle, and a revision behind them. */
  (function () {
    var self = byId[SELF_PERSONA];
    if (!self) return;
    reimbursements.unshift({
      id: 'RB99001', employee: self.id, kind: 'Learning', amount: 18500,
      on: iso(addDays(TODAY, -9)), claimed: iso(addDays(TODAY, -9)), status: 'Approved',
      paidIn: null, receipt: true, approver: self.manager, note: null
    });
    reimbursements.unshift({
      id: 'RB99002', employee: self.id, kind: 'Internet', amount: 1450,
      on: iso(addDays(TODAY, -3)), claimed: iso(addDays(TODAY, -3)), status: 'Awaiting approval',
      paidIn: null, receipt: true, approver: self.manager, note: null
    });
    reimbursements.unshift({
      id: 'RB99003', employee: self.id, kind: 'Travel', amount: 12200,
      on: iso(addDays(TODAY, -48)), claimed: iso(addDays(TODAY, -48)), status: 'Paid',
      paidIn: 'pay-2026-10', receipt: true, approver: self.manager, note: null
    });
    salaryRevisions.unshift({
      id: 'SR99001', employee: self.id,
      from: Math.round(self.ctc / 1.12 / 1000) * 1000, to: self.ctc, pct: 12,
      effective: '2026-07-01', reason: 'Annual review', arrears: 0, approvedBy: id('Priya Sharma')
    });
  })();

  var LOAN_KINDS = ['Salary advance', 'Personal loan', 'Education loan', 'Medical advance'];
  var loans = [];
  shuffle(payable).slice(0, 22).forEach(function (e, n) {
    var principal = Math.round((40000 + r() * 260000) / 1000) * 1000;
    var months = pick([6, 10, 12, 18, 24]);
    var emi = Math.round(principal / months / 100) * 100;
    var paid = Math.floor(r() * months);
    loans.push({
      id: 'LN' + (96000 + n), employee: e.id, kind: LOAN_KINDS[n % LOAN_KINDS.length],
      principal: principal, months: months, emi: emi,
      paidInstalments: paid, outstanding: Math.max(0, principal - emi * paid),
      status: n > 18 ? 'Settled' : 'Running',
      started: iso(addDays(TODAY, -(paid * 30 + 10))), approvedBy: id('Priya Sharma')
    });
  });

  /* --------------------------------------------- Reward claims (PRD 4.46, 2.3)
     What people have spent their reward points on. The catalogue, the costs and the
     gates live in js/perf.js, because they are rules rather than records; this is only
     what has been claimed and where each claim stands. A claim is raised by the
     employee, approved by their manager, and — where the reward costs the company
     money rather than a day — by HR after that. */
  var REWARD_PICKS = ['wfh1', 'wfh2', 'learn', 'wfh1', 'leave', 'wfh1', 'learn', 'wfh2', 'var', 'wfh1'];
  var REWARD_COST = { wfh1: 150, wfh2: 280, learn: 220, leave: 400, var: 600 };
  var rewardClaims = [];
  shuffle(eligible).slice(0, REWARD_PICKS.length).forEach(function (e, n) {
    var k = REWARD_PICKS[n];
    rewardClaims.push({
      id: 'RW' + (80000 + n), employee: e.id, reward: k, cost: REWARD_COST[k],
      raised: iso(addDays(TODAY, -(3 + n * 4))),
      status: n < 5 ? 'Approved' : n < 8 ? 'Awaiting approval' : n === 8 ? 'With HR' : 'Declined',
      approver: e.manager,
      note: n === 9 ? 'Asked for a release week. Raise it again for a quieter one.' : null
    });
  });

  /* ------------------------------------------------------------------ Exports */
  HRMS.seed = {
    today: TODAY, todayIso: iso(TODAY), todayLabel: pretty(TODAY),
    org: ORG, entities: ENTITIES, locations: LOCATIONS, departments: DEPARTMENTS, designations: DESIGNATIONS,
    teams: TEAMS, numbering: NUMBERING,
    leaveLedger: leaveLedger,
    roles: ROLES,
    employees: employees, byId: byId, byName: byName,
    leaveTypes: LEAVE_TYPES, leavePolicies: LEAVE_POLICIES, leaveRequests: leaveRequests, balances: balances,
    shifts: SHIFTS, shiftAssignments: shiftAssignments, shiftSwaps: shiftSwaps,
    attendanceToday: attendanceToday, regularizations: regularizations, holidays: HOLIDAYS,
    assets: assets, assetRequests: assetRequests, assetCategories: ASSET_CATS.map(function (c) { return c.name; }),
    onboarding: onboarding, onboardingTemplates: ONB_TEMPLATES, onboardingTaskNames: ONB_TASKS,
    offboarding: offboarding, offboardingTaskNames: OFB_TASKS, exitReasons: EXIT_REASONS,
    policies: POLICIES, acknowledgements: acknowledgements, documentCategories: DOC_CATEGORIES,
    employeeDocuments: employeeDocuments,
    salaryComponents: SALARY_COMPONENTS, salaryStructures: SALARY_STRUCTURES, payrollCycles: payrollCycles,
    reimbursements: reimbursements, reimbursementKinds: REIMBURSEMENT_KINDS,
    salaryRevisions: salaryRevisions, loans: loans,
    payslips: payslips, taxDeclarations: taxDeclarations,
    perfCycles: PERF_CYCLES, competencies: COMPETENCIES, assessments: assessments, goals: goals,
    surveys: SURVEYS, surveyQuestions: SURVEY_QUESTIONS, surveyResponses: surveyResponses,
    recognition: recognition, feedback: feedback, actionPlans: ACTION_PLANS,
    rewardClaims: rewardClaims,
    announcements: ANNOUNCEMENTS,
    announcementReactions: ANNOUNCEMENT_REACTIONS, announcementComments: ANNOUNCEMENT_COMMENTS,
    approvals: approvals, notifications: notifications, audit: AUDIT,
    birthdays: birthdays, anniversaries: anniversaries,
    users: users, integrations: INTEGRATIONS, billing: BILLING,
    aiUsage: AI_USAGE, subscription: SUBSCRIPTION, setupSteps: SETUP_STEPS,
    util: { iso: iso, pretty: pretty, addDays: addDays, breakdown: breakdown },

    /* The figures PRD 15 fixes. The smoke test asserts the computed values match. */
    targets: {
      totalEmployees: 248, activeEmployees: 231, newJoinersThisMonth: 12, onLeaveToday: 18,
      pendingLeaveRequests: 14, pendingRegularizations: 8, pendingOnboardingTasks: 16, pendingAssetRequests: 7
    }
  };
})();
