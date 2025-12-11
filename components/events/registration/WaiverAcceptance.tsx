import React, { useState, useRef, useEffect } from 'react';
import { Event, WaiverSignature } from '../../../types/events';

interface WaiverAcceptanceProps {
  event: Event;
  teamState?: string;
  athleteNames: string[];
  signerName: string;
  onAccept: (signatures: WaiverSignature[]) => void;
  onBack: () => void;
}

// State-specific waiver templates
const STATE_WAIVERS: Record<string, string> = {
  DEFAULT: `RELEASE AND WAIVER OF LIABILITY

In consideration of being allowed to participate in any way in the athletic activities and events, the undersigned:

1. ASSUMPTION OF RISK: I acknowledge that participation in sports and athletic activities involves inherent risks, including but not limited to physical injury, permanent disability, paralysis, and death. I knowingly and freely assume all such risks, both known and unknown, even if arising from the negligence of the releasees or others, and assume full responsibility for my child's participation.

2. RELEASE OF LIABILITY: I, for myself, my child, and on behalf of my heirs, assigns, personal representatives, and next of kin, hereby release and hold harmless the team, its coaches, staff, volunteers, agents, and other participants (collectively "Releasees"), with respect to any and all injury, disability, death, or loss or damage to person or property, whether arising from the negligence of the releasees or otherwise.

3. MEDICAL TREATMENT AUTHORIZATION: I hereby grant permission to the team staff and coaches to authorize emergency medical treatment for my child if I am not available to give consent. I agree to be financially responsible for any medical treatment provided to my child.

4. PHOTO/VIDEO RELEASE: I grant permission for photos and videos of my child to be used for team purposes, including social media, promotional materials, and team records.

5. CODE OF CONDUCT: I agree that my child will follow all team rules and code of conduct, and I will support the team's policies regarding sportsmanship and behavior.

By signing below, I acknowledge that I have read this waiver, understand it, and sign it voluntarily.`,

  TX: `TEXAS RELEASE AND WAIVER OF LIABILITY

Pursuant to Texas Civil Practice and Remedies Code Chapter 87 and Texas Education Code Section 33.081, the undersigned agrees to the following:

1. ASSUMPTION OF RISK: I acknowledge that participation in sports and recreational activities involves certain inherent risks that cannot be eliminated regardless of the care taken to avoid injuries. I knowingly and freely assume all such risks.

2. RELEASE OF LIABILITY: To the fullest extent permitted by Texas law, I hereby release, discharge, and agree not to sue the organization, its coaches, staff, volunteers, agents, and other participants from any and all claims, actions, or losses for bodily injury, property damage, wrongful death, loss of services, or otherwise which may arise out of my child's participation.

3. INDEMNIFICATION: I agree to indemnify and hold harmless the released parties from any claims, damages, losses, and expenses arising out of my child's participation.

4. MEDICAL AUTHORIZATION: Pursuant to Texas Family Code Section 32.001, I authorize emergency medical treatment for my child in the event I cannot be reached.

5. PHOTO/VIDEO CONSENT: I consent to the use of my child's image in accordance with Texas laws regarding publicity rights.

This waiver shall be construed in accordance with the laws of the State of Texas.`,

  CA: `CALIFORNIA RELEASE AND WAIVER OF LIABILITY

In accordance with California Civil Code Section 1542, the undersigned agrees to the following:

1. ASSUMPTION OF RISK: I acknowledge that participation in athletic activities involves inherent risks which include but are not limited to: physical injury, permanent disability, paralysis, and death. I knowingly and voluntarily assume all such risks.

2. WAIVER OF CALIFORNIA CIVIL CODE SECTION 1542: I expressly waive and relinquish all rights and benefits under Section 1542 of the California Civil Code, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party."

3. RELEASE OF LIABILITY: I hereby release and forever discharge the organization, its officers, agents, employees, coaches, and volunteers from any and all claims, demands, damages, rights of action, or causes of action arising from my child's participation.

4. MEDICAL AUTHORIZATION: I authorize emergency medical treatment for my child pursuant to California Family Code Section 6910.

5. MEDIA RELEASE: In accordance with California law, I consent to the organization's use of my child's photograph, video, and likeness.

This agreement shall be governed by California law.`,

  FL: `FLORIDA RELEASE AND WAIVER OF LIABILITY

In accordance with Florida Statute 768.1325 and Florida common law, the undersigned agrees to the following:

1. ASSUMPTION OF RISK: I acknowledge and agree that participation in sports and athletic activities involves inherent risks, and I knowingly and voluntarily assume all such risks.

2. RELEASE FROM LIABILITY: To the extent permitted by Florida law, I hereby release, discharge, and hold harmless the organization, its officers, directors, employees, agents, volunteers, and coaches from any and all liability, claims, demands, or causes of action that I or my child may have for injuries arising out of participation.

3. WAIVER OF NEGLIGENCE CLAIMS: I expressly waive any claims for negligence against the released parties, to the fullest extent permitted under Florida law.

4. MEDICAL CONSENT: I authorize emergency medical treatment for my child when I cannot be reached, in accordance with Florida Statute 743.064.

5. PUBLICITY RELEASE: I grant permission for photos and videos pursuant to Florida's publicity rights laws.

This waiver shall be governed by the laws of the State of Florida.`,

  NY: `NEW YORK RELEASE AND WAIVER OF LIABILITY

In accordance with New York General Obligations Law, the undersigned agrees to the following:

1. ASSUMPTION OF RISK: Pursuant to the doctrine of primary assumption of risk under New York law, I acknowledge that participation in athletic activities involves certain inherent risks that cannot be eliminated. I knowingly assume all such risks.

2. RELEASE OF LIABILITY: I hereby release and agree not to sue the organization, coaches, volunteers, and staff for any injury, death, or damages arising from my child's participation, except to the extent caused by gross negligence or intentional misconduct.

3. COMPLIANCE WITH GENERAL OBLIGATIONS LAW: This release is intended to comply with New York General Obligations Law Section 5-326 and applies to recreational activities.

4. MEDICAL AUTHORIZATION: I authorize emergency medical care for my child in accordance with New York Public Health Law.

5. IMAGE RELEASE: I consent to the use of my child's likeness in accordance with New York Civil Rights Law Sections 50-51.

This agreement shall be governed by the laws of New York State.`
};

export const WaiverAcceptance: React.FC<WaiverAcceptanceProps> = ({
  event,
  teamState,
  athleteNames,
  signerName,
  onAccept,
  onBack
}) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [signature, setSignature] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [signatureDate] = useState(new Date().toLocaleDateString());
  const waiverRef = useRef<HTMLDivElement>(null);

  // Get appropriate waiver text
  const getWaiverText = (): string => {
    // If event has custom waiver, use that
    if (event.waiver?.type === 'custom' && event.waiver.customText) {
      return event.waiver.customText;
    }
    // Otherwise use state-specific or default
    const state = teamState?.toUpperCase() || 'DEFAULT';
    return STATE_WAIVERS[state] || STATE_WAIVERS.DEFAULT;
  };

  const waiverText = getWaiverText();

  // Track scroll position to enable signing
  useEffect(() => {
    const handleScroll = () => {
      if (waiverRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = waiverRef.current;
        // Consider scrolled to bottom if within 50px of bottom
        if (scrollTop + clientHeight >= scrollHeight - 50) {
          setHasScrolledToBottom(true);
        }
      }
    };

    const waiverElement = waiverRef.current;
    if (waiverElement) {
      waiverElement.addEventListener('scroll', handleScroll);
      // Check if content is short enough that no scroll is needed
      if (waiverElement.scrollHeight <= waiverElement.clientHeight) {
        setHasScrolledToBottom(true);
      }
    }

    return () => {
      if (waiverElement) {
        waiverElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const isValid = hasScrolledToBottom && 
                  signature.trim().toLowerCase() === signerName.toLowerCase() && 
                  isAgreed;

  const handleAccept = () => {
    if (!isValid) return;

    const signatures: WaiverSignature[] = athleteNames.map(name => ({
      athleteName: name,
      signedBy: signerName,
      signedAt: new Date(),
      ipAddress: '', // Will be captured on backend
      waiverVersion: event.waiver?.customText ? 'custom' : (teamState || 'default'),
      waiverText: waiverText
    }));

    onAccept(signatures);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Liability Waiver & Release
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Please read the entire waiver carefully before signing.
          {!hasScrolledToBottom && (
            <span className="text-amber-600 dark:text-amber-400 ml-2">
              (Scroll to the bottom to enable signing)
            </span>
          )}
        </p>
      </div>

      {/* Athletes being registered */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
          You are signing this waiver on behalf of:
        </p>
        <ul className="mt-2 space-y-1">
          {athleteNames.map((name, i) => (
            <li key={i} className="text-sm text-blue-700 dark:text-blue-300 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
              {name}
            </li>
          ))}
        </ul>
      </div>

      {/* Waiver Text */}
      <div
        ref={waiverRef}
        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-h-80 overflow-y-auto text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
      >
        <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-4">
          {event.title} - Waiver Agreement
        </h4>
        {waiverText}
        
        <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
          <p className="font-semibold">
            Event: {event.title}
          </p>
          <p>
            Date: {event.eventStartDate 
              ? (typeof event.eventStartDate.toDate === 'function' 
                  ? event.eventStartDate.toDate().toLocaleDateString() 
                  : new Date(event.eventStartDate as any).toLocaleDateString())
              : 'TBD'
            } - {event.eventEndDate 
              ? (typeof event.eventEndDate.toDate === 'function' 
                  ? event.eventEndDate.toDate().toLocaleDateString() 
                  : new Date(event.eventEndDate as any).toLocaleDateString())
              : 'TBD'
            }
          </p>
          {event.location?.name && (
            <p>Location: {event.location.name}</p>
          )}
        </div>
      </div>

      {/* Scroll indicator */}
      {!hasScrolledToBottom && (
        <div className="flex items-center justify-center text-amber-600 dark:text-amber-400 text-sm">
          <svg className="w-5 h-5 mr-2 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Scroll down to read the entire waiver
        </div>
      )}

      {/* Signature Section */}
      <div className={`space-y-4 transition-opacity ${hasScrolledToBottom ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        {/* Agreement Checkbox */}
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={isAgreed}
            onChange={(e) => setIsAgreed(e.target.checked)}
            disabled={!hasScrolledToBottom}
            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I have read and understand the above waiver and release of liability. I acknowledge the inherent risks 
            involved in athletic activities and voluntarily agree to assume those risks. I am the parent/legal guardian 
            of the athlete(s) listed above and have the authority to sign this waiver on their behalf.
          </span>
        </label>

        {/* Electronic Signature */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Electronic Signature
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Type your full name exactly as it appears: <strong>{signerName}</strong>
          </p>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            disabled={!hasScrolledToBottom}
            placeholder="Type your full name to sign"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-serif italic text-lg"
          />
          {signature && signature.trim().toLowerCase() !== signerName.toLowerCase() && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Signature must match: {signerName}
            </p>
          )}
        </div>

        {/* Signature confirmation */}
        {signature.trim().toLowerCase() === signerName.toLowerCase() && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center text-green-700 dark:text-green-300">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Signature verified</span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Signed electronically by <strong>{signature}</strong> on {signatureDate}
            </p>
          </div>
        )}
      </div>

      {/* Legal notice */}
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
        <p>
          <strong>Electronic Signature Disclosure:</strong> By typing your name above, you agree that your electronic 
          signature is the legal equivalent of your manual signature on this waiver. This electronic signature is 
          legally binding and enforceable under the Electronic Signatures in Global and National Commerce Act (E-SIGN), 
          15 U.S.C. § 7001 et seq.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleAccept}
          disabled={!isValid}
          className={`px-8 py-2 rounded-lg font-medium transition-colors ${
            isValid
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          Accept & Continue to Payment
        </button>
      </div>
    </div>
  );
};

export default WaiverAcceptance;
