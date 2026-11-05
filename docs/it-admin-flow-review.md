# The IT Admin flow: what is there, what is missing, and where it runs into other modules

A read of every screen the Admin workspace can reach, as the prototype stands today.
Written after adding the integration catalogue and the Data and retention module, so it
already counts those.

---

## 1. What the Admin workspace holds today

Ten modules, thirty-three screens.

| Module | Screens | What the admin does there |
|---|---|---|
| Dashboard | 1 (two options) | Accounts, MFA coverage, sign-in activity, access queue, asset requests, alerts |
| Search | 1 | Everything the role may see |
| Organization | 7 | Company, locations, org tree, teams, working week, branding, email templates |
| Assets | 6 | Dashboard, inventory, allocations, requests, returns, maintenance |
| Users | 2 | Every account; the access-request inbox |
| Permissions | 2 | Access review; what each role may do per module |
| Billing and usage | 2 | Plan, seats, payment methods, invoices; AI credit usage |
| Integrations | 1 | 34 providers across nine categories; connect, configure, disconnect |
| Data and retention | 3 | Export; import from another application; retention, legal holds, erasure |
| Security | 1 | Sign-in rules, blocked accounts, who has a second step |
| Audit logs | 6 | Activity, configuration, permissions, logins, security events, export |

That covers the platform-administration half of the job well. What it does not yet cover
is the half where the admin is a **participant in someone else's process** — the joiner,
the leaver, the payroll run — and that is where most of the gaps below sit.

---

## 2. Gaps, in the order I would close them

### 2.1 There is no IT task queue for a joiner or a leaver — the biggest hole

HR's onboarding checklist and the admin's work are the same work, split across two
workspaces with no link between them.

- The admin dashboard shows **Open onboarding tasks: 16** and sends you to a count, not
  to anything you can do.
- HR owns `hr/onboarding/cases`, where the blocker on a case is routinely *IT has not
  created the account* — and nothing in the Admin workspace lists those.
- The same thing happens backwards on exit: `hr/offboarding/clearance` carries an
  "access revocation" row, and `admin/roles/review` separately lists *people who have
  left and can still sign in*. Two lists of one fact, neither aware of the other.

**What is missing:** an admin-side queue of the IT steps, per person, with a due date
that is the joining date or the last working day — create the account, enrol MFA, put
them in the right groups, issue the device, and on exit the exact reverse. The data to
build it already exists (onboarding cases, exits, the asset register, the user list);
what does not exist is the screen that gathers it.

This is the one I would build first. Everything else on this list is an improvement;
this one is a missing step in a flow that currently cannot be completed inside the
product.

### 2.2 The single sign-on alert points at a screen that cannot configure single sign-on

The dashboard raises **"Single sign-on not configured"** and links to `admin/settings`
(Security), which carries sign-in rules, blocked accounts and 2-step — and nothing about
SSO. SSO now genuinely lives in Integrations, under Microsoft Entra ID, Okta or Google
Workspace.

**Two things to fix:** point the alert at `admin/integrations`, and give Security a
short authentication section that *states* which provider is the identity source and
links out to it, so Security is not silently incomplete.

### 2.3 Access grants have no expiry, though Access review assumes they do

`admin/roles/review` says it surfaces *"temporary grants about to lapse"*, but nothing
anywhere can create a temporary grant. The access-request inbox (`admin/users/access`)
offers Approve and Decline and no third option.

**What is missing:** Approve **until** a date, a second approver for anything that grants
admin or HR rights, and a reason recorded against the grant. Access review becomes real
the moment grants can expire.

### 2.4 Security is missing three things an IT admin will look for

- **Sessions.** No way to see active sessions or sign someone out everywhere. This is
  the first thing anyone reaches for when a laptop goes missing.
- **Service accounts and API tokens.** Integrations hold API keys, but there is no list
  of the credentials *this* product has issued, who issued them, and when they were last
  used.
- **Password and lockout policy as an editable thing.** Sign-in rules read as fixed text.

### 2.5 Seats and users do not talk to each other

Billing says **"Set 248 seats"**; Users shows 245 active accounts. Inviting past the seat
count has no guard and no warning, and nothing on the invite flow mentions the renewal
cost. The two screens model the same number and never compare it.

### 2.6 Retention is configured in two places

The new `admin/data/retention` sets a schedule per record kind. `admin/audit/export`
carries its own Retention card for log retention. Those must be one setting — audit logs
are already a row in the retention table, and two screens that both claim to own a
statutory period is exactly how a data map goes wrong.

### 2.7 Notifications have no routing

`admin/org/emails` edits the text of the messages the product sends. Now that Slack and
Teams are in the catalogue, nothing decides **who gets which event on which channel**.
An approval that reaches Slack and an email that reaches nobody is a configuration
question with no screen.

### 2.8 Backup, restore and platform status

The dashboard reports **"Nightly backup completed"** and links to Security, which never
mentions backups. Nothing shows the backup history, lets you ask for a restore point, or
reports an incident or a scheduled maintenance window. Option B's health card is the
closest thing and it is four lines on a dashboard.

### 2.9 Device integrations do not show up on the asset they manage

Intune and Jamf both declare they can import assets, but an asset record has no field
saying *this device is enrolled in Jamf and last checked in on Tuesday*. The link exists
in the catalogue and stops at the catalogue.

---

## 3. Where the admin flow continues into other modules

The admin's work does not end at the Administration group in the sidebar. These are the
seams, with the module on the other side:

| The admin does | It continues in | What is missing at the seam |
|---|---|---|
| Creates the account, enrols MFA, assigns groups | **HR → Onboarding** | The admin has no view of the joiners waiting on them (§2.1) |
| Revokes access on the last working day | **HR → Offboarding → Clearance** | Clearance has a row for it; the admin has no queue (§2.1) |
| Issues the laptop and the access card | **Assets → Allocations** (admin-owned, employee- and HR-requested) | Works today. The device integrations do not feed it (§2.9) |
| Connects Razorpay for salary payouts | **HR → Payroll → Cycles** | The admin owns the connection; HR runs the batch. No screen says a payout failed |
| Connects Tally or QuickBooks | **HR → Payroll → Statutory** | The journal export has no run history |
| Connects the biometric gateway | **HR → Attendance → Regularization** | A device that stops reporting raises nothing |
| Connects Drive, Dropbox or DocuSign | **HR → Documents and policies** | Retention is set per record kind; the folder permissions that follow a role are described but not shown |
| Connects Greenhouse or LinkedIn | **Recruitment → the employee record** | A hired candidate becoming an employee is described in the catalogue and has no screen |
| Sets the retention schedule | **Every module that holds a record** | Nothing warns a module that its records are about to age out |
| Sets who may do what | **Every module** | `js/permissions.js` is the single source and it is honest; the Permissions screen reflects it |

Two of these are worth calling out as *flows the admin starts and cannot finish*:

1. **Payroll payouts.** The admin connects Razorpay and from that point has no visibility.
   A failed batch is a payroll problem, a finance problem and an IT problem, and none of
   the three has a screen for it.
2. **Attendance devices.** The gateway is an admin-owned connection whose failure shows
   up as missing punches in HR's regularisation queue days later.

---

## 4. If I were ordering the work

1. **The joiner/leaver IT queue** (§2.1) — the only genuinely missing step in a flow.
2. **Fix the SSO alert's destination and name the identity source on Security** (§2.2) —
   small, and it stops the product pointing at the wrong screen.
3. **Time-boxed access grants and a second approver** (§2.3) — makes Access review mean
   something.
4. **One retention setting** (§2.6) — a correctness fix, not a feature.
5. **Sessions and service accounts on Security** (§2.4).
6. **Seat guard on invite** (§2.5).
7. **Notification routing** (§2.7), then **backup and status** (§2.8), then **device
   provenance on the asset** (§2.9).
