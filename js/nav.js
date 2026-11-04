/* The information architecture, mapped from the PRD.
   Sidebar groups and items follow the role navigation in PRD sections 2.1-2.3.
   Each item's `tabs` are the deeper screens listed in section 11, rendered as module tabs
   inside the page rather than as extra sidebar rows.
   `section` points back at the PRD paragraph; `note` says what the screen is for. Both show
   on screens that are still stubs, so the IA can be reviewed against the document. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});

  /* ------------------------------------------------------------------ ADMIN */
  /* --------------------------------------------------- ADMIN items */
  var ADMIN_ITEMS = [
    { path: 'dashboard', label: 'Dashboard', icon: 'home', section: '9.1',
      note: 'Organization governance: headcount, setup progress, seat and AI usage, recent activity.' },

    /* Search is the same screen in all three workspaces: it searches only what the
       signed-in role may view, so it needs no permission entry of its own. */
    { path: 'search', label: 'Search', icon: 'search', section: '11.1',
      note: 'People, requests, records and screens, across everything this workspace may see.' },

    /* People and Users are two modules about two things, and they are kept apart.
       People is the organization: who reports to whom, which team they sit in, who is
       joining or leaving, who is asking for access. Users is the account: who may sign
       in, as what, and whether the invitation was accepted. People used to open on a
       Users tab that listed the same accounts as the Users module below, which is the
       duplication this removes. */
    { path: 'people', label: 'People', icon: 'users', section: '2.1', tabs: [
      { path: 'org-tree', label: 'Org tree', section: '3.2', note: 'The reporting chart, pannable and zoomable, with a person’s team loaded from the directory on selection.' },
      { path: 'teams', label: 'Teams', section: '3.2', note: 'A team’s roster, lead, composition and the actions that change it.' },
      { path: 'lifecycle', label: 'Lifecycle', section: '14.1', note: 'Joining, confirmation and exit. Exits close access automatically; confirmations go to HR to approve.' },
      { path: 'access', label: 'Access requests', section: '10', note: 'One inbox for new-user, role-change, team and system access requests.' }
    ]},

    { path: 'org', label: 'Organization', icon: 'building', section: '3.2', tabs: [
      { path: 'profile', label: 'Company profile', section: '3.2', note: 'Name, logo, industry, company size, website and registration details.' },
      { path: 'details', label: 'Organization details', section: '3.2', note: 'Time zone, default currency and regional settings.' },
      { path: 'entities', label: 'Legal entities', section: '3.2', note: 'Registered business entities, each with its own statutory configuration.' },
      { path: 'locations', label: 'Locations & branches', section: '11.2', note: 'Office locations with address, time zone, headcount and status.' },
      { path: 'chart', label: 'Org chart', section: '3.1', note: 'The position hierarchy. Positions, not people — a vacant one keeps its place in the approval path.' },
      { path: 'departments', label: 'Departments', section: '3.2', note: 'The department list with head, location and headcount against target. HR owns it; admin reads it.' },
      { path: 'teams', label: 'Teams', section: '3.2', note: 'Working groups inside a department, with their lead and size.' },
      { path: 'numbering', label: 'Employee numbering', section: '3.2', note: 'Prefix, width and next number each entity issues employee IDs from.' },
      { path: 'workweek', label: 'Work week', section: '3.2', note: 'Organization-wide working days, weekly offs and default working hours.' },
      { path: 'holidays', label: 'Holidays', section: '2.1', note: 'Global default holiday calendar that locations inherit.' },
      { path: 'settings', label: 'Organization settings', section: '2.1', note: 'Org-level defaults that cascade into the HR workspace.' }
    ]},

    { path: 'users', label: 'Users', icon: 'users', section: '2.1', tabs: [
      { path: 'all', label: 'All users', section: '2.1', note: 'Every user account with role, status and last sign-in.' },
      { path: 'active', label: 'Active', section: '2.1', note: 'Accounts that can currently sign in.' },
      { path: 'pending', label: 'Pending invitations', section: '2.1', note: 'Invitations sent but not yet accepted, with resend and revoke.' },
      { path: 'suspended', label: 'Suspended', section: '2.1', note: 'Temporarily blocked accounts, with the reason and who suspended them.' },
      { path: 'deactivated', label: 'Deactivated', section: '2.1', note: 'Closed accounts retained for audit purposes.' }
    ]},

    { path: 'roles', label: 'Roles & permissions', icon: 'shield', section: '10', tabs: [
      { path: 'predefined', label: 'Predefined roles', section: '2.1', note: 'Built-in Admin, HR, Manager and Employee roles.' },
      { path: 'custom', label: 'Custom roles', section: '2.1', note: 'Roles the organization defines for itself.' },
      { path: 'groups', label: 'Permission groups', section: '2.1', note: 'Reusable bundles of permissions that roles draw from.' },
      { path: 'modules', label: 'Module permissions', section: '10', note: 'View, create, edit, delete, approve, export and configure, per module.' },
      { path: 'data', label: 'Data access', section: '10', note: 'Scope a role to the whole org, assigned locations, departments, team or own records.' },
      { path: 'approvals', label: 'Approval permissions', section: '10', note: 'Which roles may approve which request types.' }
    ]},

    /* Two tabs, not eleven. Billing used to carry six (plan, seats, history, invoices,
       methods, change) and AI management another six beside it, which split one
       question — what are we paying for, and what are we using — across two modules
       and a dozen clicks. Billing is what you pay and what you pay it with; Usage is
       what the AI credits in that plan have been spent on. */
    { path: 'billing', label: 'Billing and usage', icon: 'card', section: '2.1', tabs: [
      { path: 'billing', label: 'Billing', icon: 'card', section: '2.1',
        note: 'Plan and renewal, seats, payment methods, invoice details and past invoices.' },
      { path: 'usage', label: 'Usage', icon: 'bolt', section: '2.1',
        note: 'What the plan includes, what the AI credits went on, and the trend against the monthly limit.' }
    ]},

    /* No tabs: the module is one page, and the providers are grouped into sections on
       it. Six tabs meant six clicks to learn what was connected, and nowhere that the
       whole picture read at once. An item with no `tabs` resolves straight to its own
       route and the tab row renders nothing. */
    { path: 'integrations', label: 'Integrations', icon: 'plug', section: '2.1',
      note: 'Connected providers, grouped by what they do.' },

    { path: 'settings', label: 'System settings', icon: 'gear', section: '2.1', tabs: [
      { path: 'general', label: 'General', section: '2.1', note: 'Date format, number format, week start and default language.' },
      { path: 'auth', label: 'Authentication', section: '2.1', note: 'Sign-in methods, multi-factor enforcement and allowed domains.' },
      { path: 'passwords', label: 'Password policy', section: '2.1', note: 'Length, complexity, rotation and reuse rules.' },
      { path: 'security', label: 'Security', section: '2.1', note: 'IP allow-lists, device trust and lockout thresholds.' },
      { path: 'sessions', label: 'Sessions', section: '2.1', note: 'Session lifetime, idle timeout and forced sign-out.' },
      { path: 'notifications', label: 'Notification defaults', section: '7.3', note: 'Which channels each notification type uses by default.' },
      { path: 'retention', label: 'Data retention', section: '2.1', note: 'How long exited employee records and logs are kept.' }
    ]},

    { path: 'audit', label: 'Audit logs', icon: 'history', section: '2.1', tabs: [
      { path: 'activity', label: 'User activity', section: '2.1', note: 'Who did what, where and when, across every module.' },
      { path: 'config', label: 'Configuration changes', section: '2.1', note: 'Before and after values for every configuration edit.' },
      { path: 'permissions', label: 'Permission changes', section: '2.1', note: 'Role and permission grants and revocations.' },
      { path: 'logins', label: 'Login history', section: '2.1', note: 'Successful and failed sign-ins with device and location.' },
      { path: 'security', label: 'Security events', section: '2.1', note: 'Lockouts, policy changes and suspicious activity.' },
      { path: 'export', label: 'Export logs', section: '8.3', note: 'Export a filtered log range as CSV for external review.' }
    ]}
  ];

  /* --------------------------------------------------------------------- HR */
  /* ------------------------------------------------------ HR items */
  var HR_ITEMS = [
    { path: 'dashboard', label: 'Dashboard', icon: 'home', section: '9.2',
      note: 'Daily HR operations: headcount, attendance, approvals, payroll and upcoming events.' },
    /* Search is the same screen in all three workspaces: it searches only what the
       signed-in role may view, so it needs no permission entry of its own. */
    { path: 'search', label: 'Search', icon: 'search', section: '11.1',
      note: 'People, requests, records and screens, across everything this workspace may see.' },
    { path: 'approvals', label: 'Approval inbox', icon: 'checklist', section: '6.5',
      note: 'One queue for every request type, with approve, reject and request-changes.' },

    { path: 'people', label: 'Employees', icon: 'users', section: '4.2', tabs: [
      { path: 'all', label: 'All employees', section: '4.2', note: 'The central employee table with search, filters, sorting and bulk actions.' },
      { path: 'new', label: 'New joiners', section: '4.1', note: 'Employees who joined inside the current review window.' },
      { path: 'probation', label: 'Probation', section: '3.3', note: 'Employees on probation, with confirmation dates approaching.' },
      { path: 'notice', label: 'Notice period', section: '3.3', note: 'Employees serving notice, with last working day and clearance progress.' },
      { path: 'exited', label: 'Exited', section: '14.1', note: 'Archived records, excluded from active headcount.' }
    ]},
    { path: 'onboarding', label: 'Onboarding', icon: 'person', section: '4.6', tabs: [
      { path: 'dashboard', label: 'Dashboard', section: '4.6', note: 'Yet to start, in progress, pending verification, completed and overdue tasks.' },
      { path: 'cases', label: 'In progress', section: '4.9', note: 'Each new joiner with task progress and the current blocker.' },
      { path: 'verification', label: 'Document verification', section: '4.8', note: 'Review uploaded documents and accept or reject each one.' },
      { path: 'templates', label: 'Templates', section: '4.7', note: 'Onboarding templates per employee type, department and location.' }
    ]},
    { path: 'offboarding', label: 'Offboarding', icon: 'logout', section: '4.48', tabs: [
      { path: 'dashboard', label: 'Dashboard', section: '4.51', note: 'Open exits, notice periods ending and pending clearances.' },
      { path: 'resignations', label: 'Resignations', section: '4.49', note: 'Submitted resignations awaiting manager and HR decision.' },
      { path: 'notice', label: 'Notice period', section: '4.50', note: 'Notice period tracker with last working day per employee.' },
      { path: 'clearance', label: 'Clearance', section: '4.50', note: 'Knowledge transfer, asset return and access revocation checklists.' },
      { path: 'settlement', label: 'Final settlement', section: '4.50', note: 'Final settlement computation, approval and exit documents.' }
    ]},

    /* Attendance and leave are one question to the person asking it: was she at work,
       and if not, why not. They were two rail items with two dashboards and two policy
       screens, so answering that meant crossing between them. One module now, the
       attendance tabs first and the leave tabs after.

       Each tab keeps the route its screen already had (`tab.route`), because the
       approvals inbox, the search index, the dashboards and the seed data all address
       hr/attendance/* and hr/leave/* directly. Moving the screens would have meant
       rewriting every one of those references to say the same thing. */
    { path: 'time', label: 'Attendance & leave', icon: 'clock', section: '4.15', tabs: [
      { path: 'attendance', route: 'hr/attendance/dashboard', group: 'Attendance', label: 'Dashboard', section: '4.15', note: 'Present, absent, late, WFH, on leave, missing punches and pending regularizations.' },
      { path: 'daily', route: 'hr/attendance/daily', group: 'Attendance', label: 'Daily', section: '4.19', note: 'One row per employee for a chosen date, with punches and hours.' },
      { path: 'monthly', route: 'hr/attendance/monthly', group: 'Attendance', label: 'Monthly', section: '4.19', note: 'Month grid per employee, with a day-status legend.' },
      { path: 'regularization', route: 'hr/attendance/regularization', group: 'Attendance', label: 'Regularization', section: '4.18', note: 'Correction requests keeping both original and corrected values.' },
      { path: 'attendance-policies', route: 'hr/attendance/policies', group: 'Attendance', label: 'Policies', section: '4.16', note: 'Working hours, grace period, overtime and work-from-home rules.' },
      { path: 'leave', route: 'hr/leave/dashboard', group: 'Leave', label: 'Dashboard', section: '4.10', note: 'Request volume, pending approvals, who is out today and upcoming leave.' },
      { path: 'requests', route: 'hr/leave/requests', group: 'Leave', label: 'Requests', section: '4.14', note: 'Every leave request with its approval trail.' },
      { path: 'calendar', route: 'hr/leave/calendar', group: 'Leave', label: 'Calendar', section: '4.14', note: 'Team calendar showing approved and pending leave against holidays.' },
      { path: 'balances', route: 'hr/leave/balances', group: 'Leave', label: 'Balances', section: '4.14', note: 'Entitlement, accrued, used and available per employee per leave type.' },
      { path: 'types', route: 'hr/leave/types', group: 'Leave', label: 'Types', section: '4.11', note: 'Casual, sick, earned and custom types with their full rule set.' },
      { path: 'leave-policies', route: 'hr/leave/policies', group: 'Leave', label: 'Policies', section: '4.11', note: 'Policies scoped by employee type, department, location and tenure.' }
    ]},
    { path: 'shifts', label: 'Shifts', icon: 'hourglass', section: '4.20', tabs: [
      { path: 'dashboard', label: 'Dashboard', section: '4.23', note: 'Coverage per shift, unassigned employees and open swap requests.' },
      { path: 'templates', label: 'Templates', section: '4.20', note: 'Shift definitions with timing, break, grace period and night flag.' },
      { path: 'roster', label: 'Roster', section: '4.21', note: 'Weekly and monthly roster with bulk and rotational assignment.' },
      { path: 'swaps', label: 'Swap requests', section: '4.22', note: 'Swap requests needing the replacement employee and manager to confirm.' }
    ]},
    { path: 'holidays', label: 'Holiday calendar', icon: 'star', section: '4.11',
      note: 'Holiday calendars per location, including optional and restricted holidays.' },

    { path: 'payroll', label: 'Payroll', icon: 'card', section: '4.36', tabs: [
      { path: 'dashboard', label: 'Dashboard', section: '4.36', note: 'Total cost, gross, deductions, net payable and processing status.' },
      { path: 'cycles', label: 'Cycles', section: '4.35', note: 'Payroll runs with cut-off, pay date and current stage.' },
      { path: 'processing', label: 'Processing', section: '4.35', note: 'The fifteen-step run: pull inputs, calculate, review, approve, lock, publish.' },
      { path: 'structures', label: 'Salary structures', section: '4.34', note: 'CTC to net breakdowns, assignable to employees.' },
      { path: 'components', label: 'Components', section: '4.34', note: 'Earnings, deductions and employer contributions with calculation methods.' },
      { path: 'payslips', label: 'Payslips', section: '4.38', note: 'Generated payslips with publish state and download.' },
      { path: 'tax', label: 'Tax declarations', section: '4.37', note: 'Employee declarations and investment proofs awaiting verification.' },
      /* Processing a month, rather than describing it: the stages a run moves
         through, what it owes the statutory bodies, and the two inputs — claims and
         recoveries — that make one month differ from the last. */
      { path: 'run', label: 'Run payroll', section: '4.35', note: 'The open cycle through inputs, preview, approval, payment and filing, with every exception called out first.' },
      { path: 'statutory', label: 'Statutory', section: '4.36', note: 'PF, ESI, professional tax and TDS: what is owed, to whom, by when, and the rates behind each.' },
      { path: 'reimbursements', label: 'Reimbursements', section: '4.36', note: 'Expense claims across the organization and which ones the next cycle carries.' },
      { path: 'loans', label: 'Loans & advances', section: '4.36', note: 'What the company has lent, what is outstanding and what each cycle recovers.' }
    ]},
    { path: 'assets', label: 'Assets', icon: 'package', section: '4.33', tabs: [
      { path: 'dashboard', label: 'Dashboard', section: '4.33', note: 'Inventory by status and category, plus open requests and returns.' },
      { path: 'inventory', label: 'Inventory', section: '4.29', note: 'Every asset with serial, warranty, condition, location and holder.' },
      { path: 'allocations', label: 'Allocations', section: '4.30', note: 'Current assignments with employee acknowledgement state.' },
      { path: 'requests', label: 'Requests', section: '4.31', note: 'Employee asset requests awaiting availability check and approval.' },
      { path: 'returns', label: 'Returns', section: '4.32', note: 'Return tasks from offboarding, with condition verification.' },
      { path: 'maintenance', label: 'Maintenance', section: '4.33', note: 'Service records and assets currently out of circulation.' }
    ]},

    { path: 'documents', label: 'Documents & policies', icon: 'file', section: '4.27', tabs: [
      { path: 'company', label: 'Company documents', section: '4.24', note: 'Handbook, code of conduct and other org-wide documents.' },
      { path: 'employee', label: 'Employee documents', section: '4.24', note: 'Identity, address, education and employment documents per person.' },
      { path: 'policies', label: 'Policy library', section: '4.25', note: 'Published policies with version history and audience.' },
      { path: 'acknowledgements', label: 'Acknowledgements', section: '4.26', note: 'Who has acknowledged each policy, and who is outstanding.' },
      { path: 'expiring', label: 'Expiring', section: '4.27', note: 'Documents approaching their expiry date.' }
    ]},
    { path: 'performance', label: 'Performance', icon: 'target', section: '4.47', tabs: [
      { path: 'dashboard', label: 'Dashboard', section: '4.47', note: 'Cycle progress, completion rate and rating distribution.' },
      { path: 'cycles', label: 'Cycles', section: '4.44', note: 'Appraisal cycles with period, eligibility, reviewers and workflow.' },
      { path: 'criteria', label: 'Criteria', section: '4.43', note: 'Competencies, rating scales and weightings.' },
      { path: 'goals', label: 'Goals', section: '4.46', note: 'Goals and KPIs assigned across the organization.' },
      { path: 'reviews', label: 'Reviews', section: '4.45', note: 'Self-assessment, manager review and peer feedback progress.' },
      { path: 'calibration', label: 'Calibration', section: '4.45', note: 'Normalise ratings across teams before publishing.' },
      { path: 'results', label: 'Results', section: '4.45', note: 'Final approved results and their publication state.' },
      /* The standings: one score out of a hundred per person, the badges behind it and
         the rewards those points buy. HR sees the whole organization. */
      { path: 'board', label: 'Leaderboard', section: '4.47', note: 'Everyone ranked by performance score, with the seven dimensions behind each one.' },
      { path: 'badges', label: 'Badges', section: '4.47', note: 'What the organization recognises, what each badge asks for and who holds it.' },
      { path: 'rewards', label: 'Rewards', section: '4.47', note: 'The reward catalogue people claim their points against, and where each claim stands.' }
    ]},

    { path: 'announcements', label: 'Announcements', icon: 'flag', section: '4.39',
      note: 'Post to the whole organization. Everyone can react and comment; only HR can post.' },
    { path: 'engagement', label: 'Engagement', icon: 'smile', section: '4.42', tabs: [
      { path: 'dashboard', label: 'Dashboard', section: '4.42', note: 'Participation, engagement trend and open action plans.' },
      { path: 'surveys', label: 'Surveys', section: '4.40', note: 'Survey library with audience, window and response rate.' },
      { path: 'builder', label: 'Builder', section: '4.40', note: 'Build a survey from single choice, multi choice, rating, NPS, text and yes/no.' },
      { path: 'responses', label: 'Responses', section: '4.41', note: 'Responses, with anonymity preserved where the survey is anonymous.' },
      { path: 'analytics', label: 'Analytics', section: '4.42', note: 'Scores by department, location and tenure, and movement over time.' },
      { path: 'feedback', label: 'Feedback', section: '4.42', note: 'Continuous feedback and recognition submitted by employees.' },
      { path: 'actions', label: 'Action plans', section: '4.41', note: 'Improvement actions created from survey findings, with owners.' }
    ]},

    { path: 'reports', label: 'Reports', icon: 'reports', section: '8.2', tabs: [
      { path: 'employee', label: 'Employee', section: '8.2', note: 'Headcount, distribution, new joiners, attrition and status reports.' },
      { path: 'attendance', label: 'Attendance', section: '8.2', note: 'Summary, late arrival, absenteeism, overtime and regularization.' },
      { path: 'leave', label: 'Leave', section: '8.2', note: 'Utilisation, balance, trends and department-wise leave.' },
      { path: 'payroll', label: 'Payroll', section: '8.2', note: 'Payroll summary, salary distribution, deductions and history.' },
      { path: 'performance', label: 'Performance', section: '8.2', note: 'Appraisal completion, goal achievement and rating distribution.' },
      { path: 'engagement', label: 'Engagement', section: '8.2', note: 'Participation, response rate and engagement trends.' },
      { path: 'offboarding', label: 'Offboarding', section: '8.2', note: 'Exit summary, attrition reasons, pending clearance and settlements.' }
    ]},

    { path: 'config', label: 'Configuration', icon: 'sliders', section: '2.2', tabs: [
      { path: 'structure', label: 'Organization structure', section: '3.3', note: 'Departments, designations, business units and reporting hierarchy.' },
      { path: 'employee', label: 'Employee setup', section: '3.3', note: 'Employee types, statuses and the allowed status transitions.' },
      { path: 'leave', label: 'Leave policies', section: '4.11', note: 'Leave types, entitlement, accrual, carry forward and approval levels.' },
      { path: 'attendance', label: 'Attendance policies', section: '4.16', note: 'Working hours, grace period, late and overtime rules.' },
      { path: 'shifts', label: 'Shift configuration', section: '4.20', note: 'Shift templates, rotation patterns and swap rules.' },
      { path: 'payroll', label: 'Payroll configuration', section: '4.34', note: 'Frequency, cut-off, statutory rules and the approval workflow.' },
      { path: 'onboarding', label: 'Onboarding', section: '4.7', note: 'Templates, task categories, assignees and dependencies.' },
      { path: 'offboarding', label: 'Offboarding', section: '4.48', note: 'Exit reasons, notice rules and clearance checklists.' },
      { path: 'documents', label: 'Documents', section: '4.25', note: 'Categories, access rules, acknowledgement and expiry settings.' },
      { path: 'assets', label: 'Assets', section: '4.29', note: 'Asset categories, custom fields and status rules.' },
      { path: 'performance', label: 'Performance', section: '4.43', note: 'Cycles, competencies, rating scales and review hierarchy.' },
      { path: 'surveys', label: 'Surveys', section: '4.40', note: 'Question banks, templates and anonymity defaults.' },
      { path: 'workflows', label: 'Approval workflows', section: '6.2', note: 'The workflow engine: triggers, approver types, sequence and escalation.' }
    ]}
  ];

  /* --------------------------------------------------------------- EMPLOYEE */
  /* ------------------------------------------------ EMPLOYEE items */
  var ME_ITEMS = [
    { path: 'dashboard', label: 'Dashboard', icon: 'home', section: '9.3',
      note: 'Today at a glance: attendance, leave balance, shift, payslip, tasks and announcements.' },
    /* Search is the same screen in all three workspaces: it searches only what the
       signed-in role may view, so it needs no permission entry of its own. */
    { path: 'search', label: 'Search', icon: 'search', section: '11.1',
      note: 'People, requests, records and screens, across everything this workspace may see.' },
    { path: 'announcements', label: 'Announcements', icon: 'flag', section: '4.39',
      note: 'Company announcements, newest first, with pinned items on top.' },

    { path: 'profile', label: 'My profile', icon: 'person', section: '4.4', tabs: [
      { path: 'personal', label: 'Personal', section: '4.4', note: 'Name, date of birth and personal contact details.' },
      { path: 'employment', label: 'Employment', section: '4.4', note: 'Employee ID, joining date, department, designation and manager.' },
      { path: 'contact', label: 'Contact', section: '4.3', note: 'Current and permanent address.' },
      { path: 'emergency', label: 'Emergency contacts', section: '4.3', note: 'Who to reach, and how, in an emergency.' },
      { path: 'education', label: 'Education & experience', section: '2.3', note: 'Qualifications and prior employment.' },
      { path: 'bank', label: 'Bank details', section: '2.3', note: 'Salary account details. Changes here need HR approval.' },
      { path: 'preferences', label: 'Preferences', section: '11.1', note: 'Appearance and other personal preferences held in this browser.' },
      { path: 'notifications', label: 'Notification channels', section: '7.2', note: 'Which notifications reach you in-app and by email.' }
    ]},

    /* One item, as in HR: was I at work, and if not, why not. Attendance and leave
       answered that in two rail items, so an employee checking a late mark and then
       the balance it came out of had to leave one module for the other. The
       attendance tabs come first, the leave portal after.

       Each tab keeps the route its screen already had (`tab.route`): the dashboard
       links, the tiles, the search index and the portal's own buttons all address
       me/attendance/* and me/leave/* directly, and the permission gate reads the
       route, so leave stays gated on `leave` and attendance on `attendance`.

       The two History tabs are named for what they list, because side by side in one
       tab row `History` twice says nothing about which is which. */
    { path: 'time', label: 'Attendance & leave', icon: 'clock', section: '4.17', tabs: [
      { path: 'today', route: 'me/attendance/today', group: 'Attendance', label: 'Today', section: '4.17', note: 'Check in and out, with hours worked so far against your shift.' },
      { path: 'attendance-history', route: 'me/attendance/history', group: 'Attendance', label: 'History', section: '4.17', note: 'Day-by-day record with status, punches and hours.' },
      { path: 'regularization', route: 'me/attendance/regularization', group: 'Attendance', label: 'Regularization', section: '4.18', note: 'Raise a correction for a missing or wrong punch.' },
      { path: 'leave', route: 'me/leave/overview', group: 'Leave', label: 'Overview', section: '4.12', note: 'Balance, pending requests, booked time off, who is away in your team and the holidays ahead.' },
      { path: 'apply', route: 'me/leave/apply', group: 'Leave', label: 'Apply', section: '4.12', note: 'Apply for leave, with days, balance and exclusions calculated before you submit.' },
      { path: 'balance', route: 'me/leave/balance', group: 'Leave', label: 'Balance', section: '4.12', note: 'Entitlement, used and available for each leave type.' },
      { path: 'calendar', route: 'me/leave/calendar', group: 'Leave', label: 'Who is away', section: '4.14', note: 'A month of the team\u2019s approved leave against the holiday calendar.' },
      { path: 'leave-history', route: 'me/leave/history', group: 'Leave', label: 'History', section: '4.14', note: 'Your past requests and where each one stands.' },
      { path: 'holidays', route: 'me/leave/holidays', group: 'Leave', label: 'Holidays', section: '4.11', note: 'The holidays this organization observes, including the optional ones.' }
    ]},
    { path: 'shifts', label: 'Shifts', icon: 'hourglass', section: '4.21', tabs: [
      { path: 'mine', label: 'Roster', section: '4.21', note: 'Your published roster for the week and month ahead.' },
      { path: 'swaps', label: 'Swap requests', section: '4.22', note: 'Request a swap and track swaps others have asked of you.' }
    ]},

    { path: 'documents', label: 'Documents & policies', icon: 'file', section: '4.24', tabs: [
      { path: 'mine', label: 'My documents', section: '4.24', note: 'Documents you have uploaded, with verification status and expiry.' },
      { path: 'policies', label: 'Company policies', section: '4.26', note: 'Policies that apply to you, newest version first.' },
      { path: 'acknowledgements', label: 'Acknowledgements', section: '4.26', note: 'Policies awaiting your acknowledgement, and ones you have signed.' }
    ]},

    { path: 'assets', label: 'Assets', icon: 'package', section: '4.31', tabs: [
      { path: 'assigned', label: 'Assigned', section: '4.30', note: 'What you hold, since when, and its condition on handover.' },
      { path: 'requests', label: 'Requests', section: '4.31', note: 'Request an asset and track the approval.' },
      { path: 'history', label: 'History', section: '4.33', note: 'Everything you have held and returned.' }
    ]},

    { path: 'payroll', label: 'Payroll', icon: 'card', section: '4.37', tabs: [
      { path: 'structure', label: 'Salary', section: '4.37', note: 'Your cost to company split into its components, and every revision behind it.' },
      { path: 'payslips', label: 'Payslips', section: '4.38', note: 'Every component of every month, what it is worked out from, and what reached your bank.' },
      { path: 'tax', label: 'Tax', section: '4.37', note: 'What is being deducted and why, and what the other regime would have cost you.' },
      { path: 'payments', label: 'Payment history', section: '4.37', note: 'What was paid, when, and to which account.' },
      { path: 'reimbursements', label: 'Reimbursements', section: '4.36', note: 'Money you have spent on company work, what each claim is waiting on, and what can be claimed.' },
      { path: 'documents', label: 'Tax documents', section: '4.37', note: 'Annual tax statements and related forms.' }
    ]},

    { path: 'performance', label: 'Performance', icon: 'target', section: '4.46', tabs: [
      { path: 'goals', label: 'Goals', section: '4.46', note: 'Your goals, progress and achievements.' },
      { path: 'self', label: 'Self-appraisal', section: '4.46', note: 'Complete your self-assessment for the open cycle.' },
      { path: 'feedback', label: 'Manager feedback', section: '4.46', note: 'Feedback from your manager, once published.' },
      { path: 'history', label: 'History', section: '4.46', note: 'Results from earlier appraisal cycles.' },
      { path: 'standing', label: 'My standing', section: '4.47', note: 'Your score, what the seven dimensions measured, and the badges you have earned.' },
      { path: 'board', label: 'Leaderboard', section: '4.47', note: 'Your department ranked by performance score, with your own place in it.' },
      { path: 'rewards', label: 'Rewards', section: '4.47', note: 'Your points, the tier they put you in and what they can be claimed for.' }
    ]},

    { path: 'engagement', label: 'Engagement', icon: 'smile', section: '4.41', tabs: [
      { path: 'surveys', label: 'Surveys', section: '4.41', note: 'Surveys open to you, with the closing date.' },
      { path: 'feedback', label: 'Feedback', section: '4.42', note: 'Give feedback, and see what you have shared.' },
      { path: 'recognition', label: 'Recognition', section: '2.3', note: 'Recognition you have received and given.' }
    ]},

    { path: 'exit', label: 'Offboarding', icon: 'logout', section: '4.49', tabs: [
      { path: 'resignation', label: 'Resignation', section: '4.49', note: 'Submit a resignation with proposed last working day and reason.' },
      { path: 'notice', label: 'Notice period', section: '4.50', note: 'Your notice period, approved last working day and what remains.' },
      { path: 'handover', label: 'Knowledge transfer', section: '4.50', note: 'Handover tasks assigned to you.' },
      { path: 'assets', label: 'Asset return', section: '4.32', note: 'Assets to return, and what has been verified.' },
      { path: 'formalities', label: 'Exit formalities', section: '4.50', note: 'Exit interview, final settlement and exit documents.' }
    ]}
  ];

  /* ------------------------------------------------- Global, outside a role */
  var GLOBAL = [
    { path: 'global/login', label: 'Login', section: '11.1', note: 'Email and password sign-in, with SSO where enabled.' },
    { path: 'global/forgot', label: 'Forgot password', section: '11.1', note: 'Request a reset link.' },
    { path: 'global/reset', label: 'Reset password', section: '11.1', note: 'Set a new password against the organization password policy.' },
    { path: 'global/activate', label: 'Account activation', section: '11.1', note: 'Activate an account from an invitation link.' },
    { path: 'global/invite', label: 'Invitation acceptance', section: '11.1', note: 'Accept an invitation and create credentials.' },
    { path: 'global/setup', label: 'First-run setup', section: '3.2', note: 'The organisation wizard an Admin lands on after signing up: documents, entity, offices, structure and HR access.' },
    { path: 'global/notifications', label: 'Notification centre', section: '7', note: 'Every notification addressed to you, with read state and deep links.' },
    { path: 'global/map', label: 'Screen map', section: '11', note: 'Every route in the information architecture on one page.' },
    { path: 'global/help', label: 'Help & support', section: '11.1', note: 'Guides and a way to raise a support request.' },
    { path: 'global/denied', label: 'Access denied', section: '11.1', note: 'Shown when a role lacks permission for a screen.' },
    { path: 'global/404', label: 'Page not found', section: '11.1', note: 'Shown for an unknown route.' }
  ];

  /* ----------------------------------------------------------- The sidebar

     One sidebar, every role. Admin was a flat ungrouped list of eleven items, HR had
     eight groups and the employee workspace nine — seven of those holding a single
     item, which is a flat list wearing a group's clothes. Three roles, three shapes,
     so learning where a module lives in one taught you nothing about the next.

     The plan below is the shape, and every role is built from it: the same groups in
     the same order, each slot in the same position, under the same label and icon.
     What varies by role is which slots it has at all — a slot a role has no module for
     is simply absent, and a group left empty does not draw. That is the part that
     should differ by role; where a thing sits, and what it is called, is not.

     A slot names the item path it fills, because the screens behind it belong to the
     role: HR's Employees is the roster, an employee's is their own record, and both
     belong in People under the same word. `path` is the usual case, where every role
     that has the slot reaches it by the same path; `as` is for the rest. The item
     bodies — tabs, sections, notes — stay in the per-role lists above, so the route
     table is exactly what it was before the sidebar was standardized.

     The labels lost their possessives on the way in. `My payroll` beside HR's
     `Payroll` is two names for one place in the structure, and the workspace already
     says whose data it is. */
  var PLAN = [
    { label: 'Overview', slots: [
      { label: 'Dashboard', icon: 'home', path: 'dashboard' },
      { label: 'Search', icon: 'search', path: 'search' },
      { label: 'Approval inbox', icon: 'checklist', path: 'approvals' }
    ]},
    { label: 'People', slots: [
      { label: 'Employees', icon: 'users', as: { admin: 'people', hr: 'people' } },
      { label: 'Onboarding', icon: 'person', path: 'onboarding' },
      { label: 'Offboarding', icon: 'logout', as: { hr: 'offboarding', me: 'exit' } }
    ]},
    { label: 'Time & attendance', slots: [
      { label: 'Attendance & leave', icon: 'clock', path: 'time' },
      { label: 'Shifts', icon: 'hourglass', path: 'shifts' },
      { label: 'Holiday calendar', icon: 'star', path: 'holidays' }
    ]},
    { label: 'Compensation & resources', slots: [
      { label: 'Payroll', icon: 'card', path: 'payroll' },
      { label: 'Assets', icon: 'package', path: 'assets' }
    ]},
    { label: 'Organization', slots: [
      { label: 'Organization', icon: 'building', path: 'org' },
      { label: 'Documents & policies', icon: 'file', path: 'documents' },
      { label: 'Performance', icon: 'target', path: 'performance' }
    ]},
    { label: 'Engagement', slots: [
      { label: 'Announcements', icon: 'flag', path: 'announcements' },
      { label: 'Engagement', icon: 'smile', path: 'engagement' }
    ]},
    { label: 'Insights', slots: [
      { label: 'Reports', icon: 'reports', path: 'reports' }
    ]},
    { label: 'Administration', slots: [
      { label: 'Users', icon: 'users', path: 'users' },
      { label: 'Roles & permissions', icon: 'shield', path: 'roles' },
      { label: 'Billing and usage', icon: 'card', path: 'billing' },
      { label: 'Integrations', icon: 'plug', path: 'integrations' },
      { label: 'Audit logs', icon: 'history', path: 'audit' }
    ]},
    { label: 'Configuration', slots: [
      { label: 'Configuration', icon: 'sliders', as: { admin: 'settings', hr: 'config' } }
    ]}
  ];

  /* Reachable, but not from the sidebar. Every workspace already offers the signed-in
     person their own record and preferences in the profile menu, so an employee's
     `me/profile` does not also need a rail row — and it could not honestly take the
     Employees slot, which is a roster everywhere else. The routes stay; only the row
     goes. Listed here so the orphan check below still means something. */
  var OFF_PLAN = { 'me/profile': true };

  /* A role's sidebar: the plan, carrying that role's items. The slot owns the label
     and the icon so the structure reads the same everywhere; the item keeps everything
     else, which is why the routes it generates do not move. */
  function build(role, items) {
    var byPath = {}, used = {};
    items.forEach(function (it) { byPath[it.path] = it; });
    var groups = PLAN.map(function (g) {
      var out = [];
      g.slots.forEach(function (slot) {
        var path = slot.as ? slot.as[role] : slot.path;
        var item = path ? byPath[path] : null;
        if (!item) return;
        used[path] = true;
        out.push(Object.assign({}, item, { label: slot.label, icon: slot.icon }));
      });
      return { label: g.label, items: out };
    }).filter(function (g) { return g.items.length; });

    /* An item with no slot would drop out of the sidebar silently, which is a gap in
       the plan rather than something to hide. */
    var orphans = items.filter(function (it) {
      return !used[it.path] && !OFF_PLAN[role + '/' + it.path];
    });
    if (orphans.length && window.console && window.console.warn) {
      window.console.warn('nav: no slot in the sidebar plan for ' + role + '/'
        + orphans.map(function (it) { return it.path; }).join(', '));
    }
    return groups;
  }

  var ROLES = [
    /* `persona` names the signed-in employee for the workspace. It is a name, not an ID,
       so regenerating the sample data cannot silently point it at someone else. */
    { id: 'admin', label: 'Admin', icon: 'shield', items: ADMIN_ITEMS, groups: build('admin', ADMIN_ITEMS), home: 'admin/dashboard',
      persona: 'Rohit Khanna', blurb: 'Organization setup, users, permissions, billing and platform settings.' },
    { id: 'hr', label: 'HR', icon: 'users', items: HR_ITEMS, groups: build('hr', HR_ITEMS), home: 'hr/dashboard',
      persona: 'Priya Sharma', blurb: 'People operations, policies, workflows and the employee lifecycle.' },
    { id: 'me', label: 'Employee', icon: 'person', items: ME_ITEMS, groups: build('me', ME_ITEMS), home: 'me/dashboard',
      persona: 'Ananya Rao', blurb: 'Self-service: attendance, leave, payslips, documents and reviews.' }
  ];

  /* Flattened route table: 'role/item[/tab]' -> metadata.

     Built from each role's items rather than from its sidebar, because the two are no
     longer the same list: a screen reached from the profile menu instead of a rail row
     is still a screen, and taking its row away must not take its routes. The sidebar
     supplies the group label where the item has a row, which is what the breadcrumb
     and the page eyebrow read. */
  var routes = {};
  ROLES.forEach(function (role) {
    var groupOf = {};
    role.groups.forEach(function (group) {
      group.items.forEach(function (item) { groupOf[item.path] = group.label; });
    });
    /* The sidebar's copy of an item carries the plan's label and icon, so prefer it
       over the raw one and fall back for anything kept off the sidebar. */
    var shown = {};
    role.groups.forEach(function (group) {
      group.items.forEach(function (item) { shown[item.path] = item; });
    });

    role.items.forEach(function (raw) {
      var item = shown[raw.path] || raw;
      /* A linked item opens a page outside this prototype, so it has no route of its own. */
      if (item.href) return;
      var group = groupOf[item.path] || null;
      var base = role.id + '/' + item.path;
      routes[base] = { role: role.id, group: group, item: item, label: item.label, section: item.section, note: item.note, path: base };
      (item.tabs || []).forEach(function (tab, i) {
        /* A tab may name an absolute route of its own, so one rail item can gather
           screens that already live under different paths without moving them. */
        var at = tab.route || (base + '/' + tab.path);
        routes[at] = {
          role: role.id, group: group, item: item, tab: tab, label: tab.label,
          section: tab.section, note: tab.note, path: at, isFirstTab: i === 0
        };
      });
    });
  });
  GLOBAL.forEach(function (g) {
    routes[g.path] = { role: null, group: 'Global', label: g.label, section: g.section, note: g.note, path: g.path };
  });

  function role(id) { return ROLES.filter(function (r) { return r.id === id; })[0] || ROLES[1]; }

  /* A route may be an item with tabs; the first tab is the landing screen. */
  function resolve(path) {
    if (routes[path]) {
      var m = routes[path];
      if (m.item && m.item.tabs && !m.tab) {
        var first = m.item.tabs[0];
        return routes[first.route || (path + '/' + first.path)];
      }
      return m;
    }
    return null;
  }

  HRMS.nav = {
    roles: ROLES, global: GLOBAL, routes: routes, role: role, resolve: resolve,
    count: Object.keys(routes).length
  };
})();
