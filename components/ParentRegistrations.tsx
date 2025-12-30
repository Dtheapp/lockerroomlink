/**
 * ParentRegistrations.tsx
 * Shows all registrations for a parent's children across all programs
 * Allows parents to see payment status and pay outstanding balances
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, collectionGroup, doc, getDoc } from 'firebase/firestore';
import { GlassCard, Badge, Button, GradientText, SectionHeader } from './ui/OSYSComponents';
import { Skeleton } from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import { toastError, toastInfo } from '../services/toast';
import { ChevronRight, Calendar, MapPin, DollarSign, User, Clock, CheckCircle, AlertCircle, XCircle, FileText } from 'lucide-react';

interface RegistrationWithDetails {
  id: string;
  registrationId: string;
  programId: string;
  athleteFirstName: string;
  athleteLastName: string;
  athleteAge: number;
  ageGroup: string;
  paymentStatus: 'paid' | 'pending' | 'partial' | 'waived' | 'refunded';
  paymentMethod?: string;
  fee: number;
  amountPaid?: number;
  registeredAt: any;
  programName?: string;
  programSport?: string;
  programLocation?: string;
  programStartDate?: any;
  registrationTitle?: string;
  // Promo code fields
  promoCodeUsed?: string;
  discountAmount?: number;
  originalPrice?: number;
  finalPrice?: number;
}

const ParentRegistrations: React.FC = () => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const [registrations, setRegistrations] = useState<RegistrationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReg, setSelectedReg] = useState<RegistrationWithDetails | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchAllRegistrations();
  }, [user]);

  const fetchAllRegistrations = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('[ParentRegistrations] Fetching registrations for user:', user.uid);
      
      // Query all registrants where parentId matches current user
      const registrantsQuery = query(
        collectionGroup(db, 'registrants'),
        where('parentId', '==', user.uid)
      );
      
      console.log('[ParentRegistrations] Running collectionGroup query...');
      const snapshot = await getDocs(registrantsQuery);
      console.log('[ParentRegistrations] Query returned', snapshot.size, 'results');
      
      if (snapshot.empty) {
        console.log('[ParentRegistrations] No registrations found for this user');
        setRegistrations([]);
        setLoading(false);
        return;
      }
      
      // Get registration and program details for each registrant
      const regsWithDetails: RegistrationWithDetails[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const pathParts = docSnap.ref.path.split('/');
        // Path: programs/{programId}/registrations/{regId}/registrants/{registrantId}
        const programId = pathParts[1];
        const registrationId = pathParts[3];
        
        // Fetch program details
        let programName = '';
        let programSport = '';
        let programLocation = '';
        let programStartDate = null;
        
        try {
          const programDoc = await getDoc(doc(db, 'programs', programId));
          if (programDoc.exists()) {
            const programData = programDoc.data();
            programName = programData.name || programData.programName || '';
            programSport = programData.sport || '';
            programLocation = programData.city ? `${programData.city}, ${programData.state}` : '';
          }
        } catch (e) {
          console.warn('Could not fetch program:', e);
        }
        
        // Fetch registration details
        let registrationTitle = '';
        try {
          const regDoc = await getDoc(doc(db, 'programs', programId, 'registrations', registrationId));
          if (regDoc.exists()) {
            const regData = regDoc.data();
            registrationTitle = regData.title || regData.name || '';
            programStartDate = regData.startDate || null;
          }
        } catch (e) {
          console.warn('Could not fetch registration:', e);
        }
        
        regsWithDetails.push({
          id: docSnap.id,
          registrationId,
          programId,
          athleteFirstName: data.athleteFirstName || data.firstName || '',
          athleteLastName: data.athleteLastName || data.lastName || '',
          athleteAge: data.calculatedAge || data.athleteAge || 0,
          ageGroup: data.ageGroupLabel || data.calculatedAgeGroup || data.ageGroup || '',
          paymentStatus: data.paymentStatus || 'pending',
          paymentMethod: data.paymentMethod,
          fee: data.fee || 0,
          amountPaid: data.amountPaid || 0,
          registeredAt: data.registeredAt,
          programName,
          programSport,
          programLocation,
          programStartDate,
          registrationTitle,
          // Promo code fields
          promoCodeUsed: data.promoCodeUsed,
          discountAmount: data.discountAmount,
          originalPrice: data.originalPrice,
          finalPrice: data.finalPrice
        });
      }
      
      // Sort by registration date (newest first)
      regsWithDetails.sort((a, b) => {
        const dateA = a.registeredAt?.toDate?.() || new Date(0);
        const dateB = b.registeredAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('[ParentRegistrations] Loaded', regsWithDetails.length, 'registrations with details');
      setRegistrations(regsWithDetails);
    } catch (error: any) {
      console.error('[ParentRegistrations] Error fetching registrations:', error);
      // Check for permission error
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        console.error('[ParentRegistrations] This is a permission error - check Firestore rules for collectionGroup registrants');
        toastError('Permission error loading registrations. Please try again later.');
      } else {
        toastError('Failed to load registrations');
      }
    } finally {
      setLoading(false);
    }
  };

  const getPaymentPill = (reg: RegistrationWithDetails) => {
    // Free registration
    if (reg.fee === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle className="w-3 h-3" />
          Free
        </span>
      );
    }
    
    switch (reg.paymentStatus) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            Paid
          </span>
        );
      case 'waived':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            Waived
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-3 h-3" />
            Partial (${reg.amountPaid || 0}/${reg.fee})
          </span>
        );
      case 'pending':
        // Check if pay in person
        if (reg.paymentMethod === 'cash' || reg.paymentMethod === 'check' || reg.paymentMethod === 'other') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-3 h-3" />
              Pay In Person
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3" />
            Unpaid (${reg.fee})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
            {reg.paymentStatus}
          </span>
        );
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const unpaidCount = registrations.filter(r => 
    r.fee > 0 && r.paymentStatus === 'pending' && 
    r.paymentMethod !== 'cash' && r.paymentMethod !== 'check' && r.paymentMethod !== 'other'
  ).length;

  const payInPersonCount = registrations.filter(r => 
    r.fee > 0 && r.paymentStatus === 'pending' && 
    (r.paymentMethod === 'cash' || r.paymentMethod === 'check' || r.paymentMethod === 'other')
  ).length;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <GradientText className="text-2xl md:text-3xl font-bold">My Registrations</GradientText>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            View all program registrations for your athletes
          </p>
        </div>
        
        {/* Quick stats */}
        <div className="flex gap-3">
          <div className={`px-4 py-2 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
            <p className="text-xs text-slate-400">Total</p>
            <p className="text-xl font-bold">{registrations.length}</p>
          </div>
          {unpaidCount > 0 && (
            <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">Unpaid</p>
              <p className="text-xl font-bold text-red-400">{unpaidCount}</p>
            </div>
          )}
          {payInPersonCount > 0 && (
            <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400">Pay In Person</p>
              <p className="text-xl font-bold text-amber-400">{payInPersonCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Alert for unpaid */}
      {unpaidCount > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">You have {unpaidCount} unpaid registration{unpaidCount > 1 ? 's' : ''}</p>
            <p className="text-sm text-red-400/70 mt-1">
              Please complete payment to secure your spot. Contact the program if you need assistance.
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'} flex flex-wrap gap-4 text-xs`}>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Paid / Free / Waived</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Pay In Person / Partial</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Unpaid (action needed)</span>
        </div>
      </div>

      {/* Registrations List */}
      {registrations.length === 0 ? (
        <EmptyState
          type="generic"
          icon={FileText}
          title="No Registrations Yet"
          description="When you register your athletes for programs, they'll appear here."
        />
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => (
            <GlassCard 
              key={reg.id}
              className="p-4 cursor-pointer hover:ring-2 hover:ring-purple-500/30 transition-all"
              onClick={() => setSelectedReg(reg)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Athlete Name */}
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-lg">
                      {reg.athleteFirstName} {reg.athleteLastName}
                    </span>
                    <Badge variant="default">{reg.ageGroup}</Badge>
                  </div>
                  
                  {/* Program/Registration Info */}
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {reg.registrationTitle || reg.programName}
                  </p>
                  {reg.programName && reg.registrationTitle && (
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {reg.programName}
                    </p>
                  )}
                  
                  {/* Meta info */}
                  <div className={`flex flex-wrap items-center gap-3 mt-2 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {reg.programSport && (
                      <span>🏈 {reg.programSport}</span>
                    )}
                    {reg.programLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {reg.programLocation}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Registered {formatDate(reg.registeredAt)}
                    </span>
                  </div>
                </div>
                
                {/* Payment Status */}
                <div className="flex flex-col items-end gap-2">
                  {getPaymentPill(reg)}
                  <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedReg(null)}>
          <div 
            className={`w-full max-w-lg rounded-2xl ${theme === 'dark' ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'} shadow-2xl max-h-[85vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'} sticky top-0 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'} z-10`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    {selectedReg.athleteFirstName} {selectedReg.athleteLastName}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {selectedReg.registrationTitle || selectedReg.programName}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedReg(null)}
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Status */}
              <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                <p className="text-xs text-slate-400 mb-2">Payment Status</p>
                <div className="flex items-center justify-between">
                  {getPaymentPill(selectedReg)}
                  {selectedReg.fee > 0 && (
                    <span className="font-semibold">${selectedReg.fee}</span>
                  )}
                </div>
                
                {/* Explain waived */}
                {selectedReg.paymentStatus === 'waived' && (
                  <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    💡 This fee was waived by the program commissioner (scholarship, special circumstance, etc.)
                  </p>
                )}
                
                {/* Pay In Person Reminder */}
                {selectedReg.paymentStatus === 'pending' && (selectedReg.paymentMethod === 'cash' || selectedReg.paymentMethod === 'check' || selectedReg.paymentMethod === 'other') && (
                  <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-amber-400/70' : 'text-amber-600'}`}>
                    💡 You selected to pay in person. Please bring ${selectedReg.fee} to the first event or contact the program.
                  </p>
                )}
                
                {/* Unpaid warning + Pay Now button */}
                {selectedReg.paymentStatus === 'pending' && selectedReg.fee > 0 && selectedReg.paymentMethod !== 'cash' && selectedReg.paymentMethod !== 'check' && selectedReg.paymentMethod !== 'other' && (
                  <div className="mt-3">
                    <p className={`text-xs text-red-400 mb-3`}>
                      ⚠️ Payment required to confirm registration.
                    </p>
                    <button
                      onClick={() => {
                        // TODO: Integrate PayPal payment flow
                        // For now, show a message about contacting the program
                        toastInfo('Online payment coming soon! Please contact the program to arrange payment.');
                      }}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      Pay Now (${selectedReg.fee})
                    </button>
                    <p className={`text-xs mt-2 text-center ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                      Or contact the program to arrange payment
                    </p>
                  </div>
                )}
                
                {/* Promo Code Section - Show if promo was used */}
                {selectedReg.promoCodeUsed && (
                  <div className={`mt-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🎟️</span>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-700'}`}>Promo Code Applied</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Code Used</p>
                        <p className={`font-mono font-bold mt-0.5 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                          {selectedReg.promoCodeUsed}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Discount Given</p>
                        <p className={`font-medium mt-0.5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                          -${((selectedReg.discountAmount || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                      {selectedReg.originalPrice && (
                        <>
                          <div>
                            <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Original Price</p>
                            <p className={`font-medium mt-0.5 line-through ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                              ${((selectedReg.originalPrice || 0) / 100).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Final Price</p>
                            <p className={`font-medium mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                              ${((selectedReg.finalPrice || selectedReg.fee || 0) / 100).toFixed(2)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Athlete Info */}
              <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                <p className="text-xs text-slate-400 mb-2">Athlete Information</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs">Name</p>
                    <p className="font-medium">{selectedReg.athleteFirstName} {selectedReg.athleteLastName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Age Group</p>
                    <p className="font-medium">{selectedReg.ageGroup}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Age</p>
                    <p className="font-medium">{selectedReg.athleteAge} years old</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Registered</p>
                    <p className="font-medium">{formatDate(selectedReg.registeredAt)}</p>
                  </div>
                </div>
              </div>
              
              {/* Program Info */}
              <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                <p className="text-xs text-slate-400 mb-2">Program Information</p>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs">Program</p>
                    <p className="font-medium">{selectedReg.programName}</p>
                  </div>
                  {selectedReg.registrationTitle && (
                    <div>
                      <p className="text-slate-400 text-xs">Registration</p>
                      <p className="font-medium">{selectedReg.registrationTitle}</p>
                    </div>
                  )}
                  {selectedReg.programSport && (
                    <div>
                      <p className="text-slate-400 text-xs">Sport</p>
                      <p className="font-medium">{selectedReg.programSport}</p>
                    </div>
                  )}
                  {selectedReg.programLocation && (
                    <div>
                      <p className="text-slate-400 text-xs">Location</p>
                      <p className="font-medium">{selectedReg.programLocation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <Button variant="ghost" className="w-full" onClick={() => setSelectedReg(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentRegistrations;
