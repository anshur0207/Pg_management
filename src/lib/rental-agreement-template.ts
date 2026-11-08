export type RentalAgreementTemplateInput = {
  agreementDate: string;
  ownerName: string;
  propertyName: string;
  propertyAddress: string;
  ownerPhone: string;
  residentName: string;
  checkInDate: string;
  startsOn: string;
  roomNumber: string;
  bedNumber: string;
  monthlyRentPaise: number;
  securityDepositPaise: number;
  rentDueDay: number;
  additionalTerms?: string;
};

const dateLabel = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

const amountLabel = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function getAgreementEndDate(startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);
  const targetMonth = month - 1 + 11;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const clampedDay = Math.min(day, new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate());
  const endDate = new Date(Date.UTC(targetYear, normalizedMonth, clampedDay) - 24 * 60 * 60 * 1000);
  return endDate.toISOString().slice(0, 10);
}

export function buildRentalAgreementTemplate(input: RentalAgreementTemplateInput) {
  const daySuffix = input.rentDueDay % 100 >= 11 && input.rentDueDay % 100 <= 13 ? "th" : input.rentDueDay % 10 === 1 ? "st" : input.rentDueDay % 10 === 2 ? "nd" : input.rentDueDay % 10 === 3 ? "rd" : "th";
  const dueDay = `${input.rentDueDay}${daySuffix}`;
  const additionalTerms = input.additionalTerms?.trim() || "None specified.";

  return `PG ACCOMMODATION RENTAL AGREEMENT
PG ACCOMMODATION & RESIDENT STAY AGREEMENT

This Agreement is made on ${dateLabel(input.agreementDate)}, between the following parties:

FIRST PARTY – PG OWNER / SERVICE PROVIDER

Name of PG Owner: ${input.ownerName || "Not provided"}

Property / PG Name: ${input.propertyName}

Address of PG: ${input.propertyAddress || "Not provided"}

Contact Number: ${input.ownerPhone || "Not provided"}

Hereinafter referred to as the “OWNER”.

SECOND PARTY – RESIDENT / OCCUPANT

Full Name: ${input.residentName}

Hereinafter referred to as the “RESIDENT”.

The Owner agrees to provide accommodation to the Resident at the above-mentioned PG premises, subject to the following terms and conditions.

1. RESIDENT DETAILS

Resident Name: ${input.residentName}
Check-in Date: ${dateLabel(input.checkInDate)}
Room Number: ${input.roomNumber || "Not assigned"}
Bed Number: ${input.bedNumber || "Not assigned"}
Monthly Rent: ${amountLabel(input.monthlyRentPaise)}
Security Deposit: ${amountLabel(input.securityDepositPaise)}
Rent Due Date: On or before the ${dueDay} of every month
Agreement Duration: 11 months (${dateLabel(input.startsOn)} to ${dateLabel(getAgreementEndDate(input.startsOn))})

2. RENT AND PAYMENT TERMS

1. The Resident agrees to pay the monthly accommodation rent as mutually agreed between the Owner and Resident.
2. Monthly rent shall be paid on or before the ${dueDay} of every month.
3. Any additional charges for electricity, food, laundry, maintenance or other services shall be communicated to the Resident in advance.
4. The Owner shall provide payment confirmation or a receipt for payments received.
5. Any delay in rent payment must be communicated to the Owner.
6. Applicable late payment charges, if any, shall be as mutually agreed and communicated in advance.

3. SECURITY DEPOSIT

1. The Resident shall pay a refundable security deposit of ${amountLabel(input.securityDepositPaise)}.
2. The security deposit shall be refundable at the time of checkout, subject to settlement of outstanding rent, utility bills and other agreed charges.
3. Any deduction for damage to property, furniture or fixtures beyond normal wear and tear must be reasonably assessed and communicated to the Resident.
4. The Owner shall settle the refundable security deposit within the period required by applicable local law after checkout and final settlement.
5. The security deposit shall not automatically be treated as the final month's rent.

4. HOUSE RULES AND RESIDENT RESPONSIBILITIES

1. The Resident shall maintain cleanliness and hygiene in the allocated room and common areas.
2. The Resident shall not damage the property, furniture, electrical equipment or other facilities.
3. Loud music, disruptive behaviour and activities disturbing other residents are prohibited.
4. The Resident shall respect the privacy and personal belongings of other residents.
5. Visitors must follow the PG's visitor policy and obtain prior approval wherever required.
6. The Resident shall not engage in illegal activities or store prohibited substances or dangerous materials on the premises.
7. The Resident shall not sublet, transfer or share the allocated accommodation with another person without the Owner's written permission.
8. The Resident shall follow all reasonable safety, security and operational guidelines of the PG.

5. FACILITIES AND MAINTENANCE

1. The Owner shall provide the facilities agreed upon at the time of admission.
2. The Resident shall report maintenance issues, plumbing problems, electrical faults or other damages to the Owner.
3. The Owner shall make reasonable efforts to address maintenance requests within an appropriate timeframe.
4. The Resident shall be responsible for damage caused by negligence or intentional misuse.
5. Common facilities shall be used responsibly and in accordance with the PG rules.

6. NOTICE PERIOD AND VACATING THE PREMISES

1. The Resident must provide prior written notice of a period mutually agreed in writing by both parties before vacating the accommodation.
2. The Resident shall clear all outstanding rent and other applicable charges before checkout.
3. The room and allocated belongings must be handed over in reasonable condition.
4. The Resident must return all keys, access cards and other property belonging to the Owner.
5. The Owner may initiate checkout and final settlement after the Resident vacates the premises.
6. Any early termination, notice-period waiver or associated charges shall be handled according to the mutually agreed terms.

7. OWNER'S RESPONSIBILITIES

1. The Owner shall provide the agreed accommodation and facilities in a reasonably usable condition.
2. The Owner shall maintain common areas and arrange reasonable repairs.
3. The Owner shall respect the Resident's privacy and shall not enter the allocated room without reasonable prior notice, except in emergencies.
4. The Owner shall maintain records of rent payments and security deposits.
5. The Owner shall address genuine complaints and maintenance requests within a reasonable timeframe.

8. TERMINATION OF AGREEMENT

The agreement may be terminated by either party by providing the mutually agreed notice period.

The Owner may initiate termination in cases of serious misconduct, illegal activities, repeated non-payment or material breach of the agreed terms, subject to applicable law and reasonable notice requirements.

9. ADDITIONAL TERMS AND CONDITIONS

The following additional terms have been mutually agreed upon by the Owner and Resident:

${additionalTerms}

10. DECLARATION AND ACCEPTANCE

Both parties confirm that they have read, understood and voluntarily accepted the terms and conditions mentioned in this agreement.

The Resident agrees to follow the PG rules and payment obligations throughout the stay.

The Owner agrees to provide the accommodation and facilities as mutually agreed.

Both parties acknowledge that this agreement represents their understanding regarding the PG accommodation.

SIGNATURES

PG OWNER / AUTHORISED REPRESENTATIVE
Name: ${input.ownerName || "____________________________"}
Signature: _________________________________
Date: ______________________________________

RESIDENT / OCCUPANT
Name: ${input.residentName}
Signature: ___________________________________
Date: _______________________________________

WITNESS 1
Name: ______________________________________
Signature: ___________________________________

WITNESS 2
Name: ______________________________________
Signature: ___________________________________

IMPORTANT NOTE

This is a general PG accommodation agreement template. The parties should review applicable local laws, stamp duty, registration requirements and enforceability before signing. Any additional terms must be mutually agreed upon and should not override applicable law.`;
}
