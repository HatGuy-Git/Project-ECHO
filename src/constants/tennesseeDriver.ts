export const TN_TEEN_GDL_URL =
  'https://www.tn.gov/safety/driver-services/classd/teengdl.html'

export const TN_DL_MANUAL_PDF_URL =
  'https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf'

/** Same-origin proxy route (Vite dev/preview server only) */
export const TN_DL_MANUAL_PDF_PROXY = '/api/driver-manual/pdf'

/** Bump when curation/presentation logic changes — stale manuals should be re-prepared */
export const DRIVER_MANUAL_CURATOR_VERSION = 7

/**
 * Section B of the Tennessee Comprehensive Driver License Manual —
 * the portion designed for written knowledge test preparation (pages ~25–90).
 */
export const SECTION_B_CHAPTERS = [
  {
    number: 1,
    title: 'Getting Familiar With Your Vehicle',
    testFocus: 'Vehicle controls, mirrors, seat position, and pre-drive checks',
  },
  {
    number: 2,
    title: 'Tennessee Safety Belt Laws',
    testFocus: 'Seat belts, child restraints, booster seats, and TN enforcement rules',
  },
  {
    number: 3,
    title: 'Traffic Signs and Signals',
    testFocus: 'Sign shapes, colors, signals, pavement markings, and right-of-way',
  },
  {
    number: 4,
    title: 'Rules of the Road',
    testFocus: 'Speed, turns, passing, parking, headlights, and core traffic laws',
  },
  {
    number: 5,
    title: 'Interstate Driving',
    testFocus: 'Freeway entry, lane use, following distance, and interstate hazards',
  },
  {
    number: 6,
    title: 'Driving at Night and in Inclement Weather',
    testFocus: 'Night driving, rain, fog, snow, hydroplaning, and visibility',
  },
  {
    number: 7,
    title: 'Alcohol, Other Drugs and Driving',
    testFocus: 'DUI laws, BAC limits, implied consent, and drug-impaired driving',
  },
  {
    number: 8,
    title: 'Driving Responsibility',
    testFocus: 'Insurance, points, crashes, reporting, and license consequences',
  },
] as const
