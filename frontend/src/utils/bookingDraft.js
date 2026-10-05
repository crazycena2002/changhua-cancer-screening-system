export function createBookingDraft({ reservationType, invitationCode, selectedEvent, selectedTimeSlot, bowelScreening, phone, basicProfile, qualificationResult = [], selectedScreenings, additionalScreening, email }) {
  return {
    reservationType,
    invitationCode: invitationCode || '',
    selectedEvent: selectedEvent ? { id: selectedEvent.id, date: selectedEvent.date, location: selectedEvent.location, address: selectedEvent.address, start: selectedEvent.start, end: selectedEvent.end, phone: selectedEvent.phone || '', screenings: [...(selectedEvent.screenings || [])] } : null,
    ...(reservationType === 'bowel' ? {} : { selectedTimeSlot: selectedTimeSlot || '' }),
    phone: phone || '',
    basicProfile: { ...basicProfile },
    qualificationResult: qualificationResult.map(item => ({ ...item })),
    ...(selectedScreenings ? { selectedScreenings: [...selectedScreenings] } : {}),
    additionalScreening: { ...additionalScreening, eligible: [...(additionalScreening?.eligible || [])], selected: (additionalScreening?.selected || []).map(item => ({ ...item })) },
    ...(reservationType === 'bowel' ? { bowelScreening: bowelScreening ? { ...bowelScreening, weeklySchedule: Object.fromEntries(Object.entries(bowelScreening.weeklySchedule || {}).map(([day, periods]) => [day, periods.map(period => ({ ...period }))])), selectedInstitution: bowelScreening.selectedInstitution ? { ...bowelScreening.selectedInstitution, healthCenterContact: { ...(bowelScreening.selectedInstitution.healthCenterContact || {}) } } : null, specialClosures: [...(bowelScreening.specialClosures || [])] } : null } : {}),
    email: email || '',
  }
}
