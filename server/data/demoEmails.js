export const DEMO_EMAILS = [
  {
    id: 'demo-1-safe-certification',
    label: 'DEMO 1 — Safe: Official AI Certification Programme',
    tag: 'safe',
    expected: 'LOW RISK',
    expectedLevel: 'LOW',
    summary:
      'Genuine institutional announcement. Verified sender, verified link, matching announcement record.',
    email: {
      from: 'training@northstaruniversity.edu',
      to: 'alex.kumar@northstaruniversity.edu',
      subject: 'Official AI Certification Programme — Student Registration',
      body: `Dear Students,

The Training and Development department is offering a six-week AI Certification Programme for enrolled students of Northstar University. The programme covers applied machine learning, model evaluation and responsible AI practices, and is delivered online by faculty and industry mentors.

Registration is open on the official training page and closes on 30 September 2026. There is no registration fee for enrolled students.

Register on the official page: https://northstaruniversity.edu/training/ai-certification

For clarifications, contact the Training and Development department through the student portal.

Regards,
Training and Development
Northstar University`,
      links: ['https://northstaruniversity.edu/training/ai-certification'],
      claimedDepartment: 'Training and Development',
      claimedAnnouncementType: 'Certification Programme',
    },
  },
  {
    id: 'demo-2-fake-course',
    label: 'DEMO 2 — Attack: Fake AI Certification (personalised)',
    tag: 'attack',
    expected: 'CRITICAL / HIGH RISK',
    expectedLevel: 'CRITICAL',
    summary:
      'Institution impersonation. Look-alike sender domain, personalised student data, urgency, external registration link, no matching announcement.',
    email: {
      from: 'courses@northstar-career-program.com',
      to: 'alex.kumar@northstaruniversity.edu',
      subject: 'URGENT: You Have Been Selected for AI Certification',
      body: `Dear Alex Kumar,

Congratulations! You have been selected for the exclusive AI Certification Programme at Northstar University.

Student Name: Alex Kumar
Program: B.Tech Computer Science
Semester: 3
Roll Number: 21CS0142

Only a limited number of seats are available for selected students. You must complete your registration within 24 hours or your seat will be released to the waiting list.

Complete registration immediately: https://northstar-course-registration.example/register

Note: A refundable registration fee of Rs. 499 is required to confirm your seat. Provide your student portal login to activate the certification account.

Regards,
Northstar University Certification Cell`,
      links: ['https://northstar-course-registration.example/register'],
      claimedDepartment: 'Training and Development',
      claimedAnnouncementType: 'Certification Programme',
    },
  },
  {
    id: 'demo-3-fake-placement',
    label: 'DEMO 3 — Attack: Fake Placement Verification',
    tag: 'attack',
    expected: 'CRITICAL / HIGH RISK',
    expectedLevel: 'CRITICAL',
    summary:
      'Fake placement communication. External verification form, hard deadline, credential request, no matching announcement.',
    email: {
      from: 'placements@northstar-placement.example',
      to: 'alex.kumar@northstaruniversity.edu',
      subject: 'Immediate Action Required — Placement Registration',
      body: `Dear Student,

Your placement profile requires immediate verification before the upcoming recruitment drive.

Failure to complete the verification form within 2 hours may affect your eligibility for all campus placements this semester.

Verify your placement profile now: https://student-placement.example/verify

You will be asked to sign in with your university username and password to confirm your placement eligibility.

Placement Cell
Northstar University`,
      links: ['https://student-placement.example/verify'],
      claimedDepartment: 'Placement Cell',
      claimedAnnouncementType: 'Placement Drive',
    },
  },
  {
    id: 'demo-4-suspicious-scholarship',
    label: 'DEMO 4 — Suspicious: Scholarship Application',
    tag: 'suspicious',
    expected: 'HIGH RISK — NO VERIFIED MATCH',
    expectedLevel: 'HIGH',
    summary:
      'Similar-looking domain and personalised student data, but no overt credential request or hard deadline. Demonstrates the softer end of the risk range: suspicious, unverifiable, and never reported as verified.',
    email: {
      from: 'scholarship@northstar-university-scholarship.example',
      to: 'riya.menon@northstaruniversity.edu',
      subject: 'Scholarship Application — Selected Students',
      body: `Dear Riya Menon,

You have been shortlisted for the merit scholarship scheme for the current academic year.

Program: B.Sc Information Technology
Semester: 5
Student ID: NSU-2023-0097

To complete your scholarship application, please provide your additional details through the link below.

https://northstar-scholarship-portal.example/notice

Student Affairs
Northstar University`,
      links: ['https://northstar-scholarship-portal.example/notice'],
      claimedDepartment: 'Student Affairs',
      claimedAnnouncementType: 'Scholarship Information',
    },
  },
  {
    id: 'demo-5-safe-placement',
    label: 'DEMO 5 — Safe: Official Placement Drive',
    tag: 'safe',
    expected: 'LOW RISK',
    expectedLevel: 'LOW',
    summary:
      'Genuine placement announcement from the verified Placement Cell address with the official placement portal link.',
    email: {
      from: 'placements@northstaruniversity.edu',
      to: 'daniel.osei@northstaruniversity.edu',
      subject: 'Official Placement Drive — Software Engineering',
      body: `Dear Students,

The Placement Cell is conducting the Software Engineering Placement Drive for the 2026 cohort. Eligible students must register on the placement portal before the drive date.

Eligibility: final-year students with no active backlogs.
Registration: https://northstaruniversity.edu/placements/drive-se-2026
There is no registration fee for this drive.

For queries, contact the Placement Cell at placements@northstaruniversity.edu.

Regards,
Placement Cell
Northstar University`,
      links: ['https://northstaruniversity.edu/placements/drive-se-2026'],
      claimedDepartment: 'Placement Cell',
      claimedAnnouncementType: 'Placement Drive',
    },
  },
  {
    id: 'demo-6-partial-official-sender',
    label: 'DEMO 6 — Partial match: official sender, wrong destination',
    tag: 'suspicious',
    expected: 'HIGH RISK — PARTIAL MATCH',
    expectedLevel: 'HIGH',
    summary:
      'The classic compromised-account case. The sender IS the verified institutional address and the announcement is real, but the registration link has been swapped for an external host. Topical match with a mismatched destination — never reported as verified.',
    email: {
      from: 'training@northstaruniversity.edu',
      to: 'alex.kumar@northstaruniversity.edu',
      subject: 'Official AI Certification Programme — Registration Extended',
      body: `Dear Students,

The AI Certification Programme registration has been extended for one more day. Students who have not yet registered must complete registration today.

Updated registration link: https://northstar-course-registration.example/extended

Please sign in with your university account to confirm your seat.

Training and Development
Northstar University`,
      links: ['https://northstar-course-registration.example/extended'],
      claimedDepartment: 'Training and Development',
      claimedAnnouncementType: 'Certification Programme',
    },
  },
  {
    id: 'demo-7-typosquat-workshop',
    label: 'DEMO 7 — Attack: Workshop invitation (typosquat domain)',
    tag: 'attack',
    expected: 'HIGH / CRITICAL RISK',
    expectedLevel: 'HIGH',
    summary:
      'Typosquatted look-alike domain reusing the institution name. A real workshop exists, but neither the sender nor the destination matches the verified record.',
    email: {
      from: 'workshops@northstar-university-edu.com',
      to: 'alex.kumar@northstaruniversity.edu',
      subject: 'Cybersecurity Workshop — Limited Seats',
      body: `Hello,

The Computer Science department is conducting a cybersecurity awareness workshop. Only a limited number of seats are available and registration closes today.

Register here: https://northstar-university-edu.com/workshop/register

Participants must sign in with their university account to receive the workshop certificate.

Computer Science Department`,
      links: ['https://northstar-university-edu.com/workshop/register'],
      claimedDepartment: 'Computer Science',
      claimedAnnouncementType: 'Workshop',
    },
  },
];

export function findDemoEmail(id) {
  return DEMO_EMAILS.find((d) => d.id === id);
}
