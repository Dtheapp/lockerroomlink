/**
 * OSYS Referee Verification Submission
 * Allows referees to submit documents for verification badge
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRefereeProfile, submitVerificationRequest } from '../../services/refereeService';
import { uploadFile } from '../../services/storage';
import {
  Shield,
  Upload,
  FileText,
  Check,
  AlertCircle,
  Award,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react';
import type { RefereeProfile, RefereeCertification } from '../../types/referee';

interface UploadedDocument {
  file: File;
  type: 'certification' | 'id' | 'background_check' | 'other';
  name: string;
  preview?: string;
}

interface Props {
  onComplete?: () => void;
  onCancel?: () => void;
}

export const RefereeVerificationSubmit: React.FC<Props> = ({ onComplete, onCancel }) => {
  const { user, userData } = useAuth();
  const [profile, setProfile] = useState<RefereeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedCertifications, setSelectedCertifications] = useState<RefereeCertification[]>([]);

  useEffect(() => {
    if (user?.uid) {
      loadProfile();
    }
  }, [user?.uid]);

  const loadProfile = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await getRefereeProfile(user.uid);
      setProfile(data);
      // Pre-select all certifications
      if (data?.certifications) {
        setSelectedCertifications(data.certifications);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: UploadedDocument['type']) => {
    const files = e.target.files;
    if (!files) return;

    const newDocs: UploadedDocument[] = Array.from(files).map((file) => ({
      file,
      type,
      name: file.name,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setDocuments((prev) => [...prev, ...newDocs]);
    e.target.value = ''; // Reset input
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => {
      const doc = prev[index];
      if (doc.preview) {
        URL.revokeObjectURL(doc.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleCertification = (cert: RefereeCertification) => {
    setSelectedCertifications((prev) => {
      const exists = prev.some((c) => c.name === cert.name && c.sport === cert.sport);
      if (exists) {
        return prev.filter((c) => !(c.name === cert.name && c.sport === cert.sport));
      }
      return [...prev, cert];
    });
  };

  const handleSubmit = async () => {
    if (!user || !userData) return;

    if (documents.length === 0) {
      setError('Please upload at least one document');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Upload all documents to storage
      const uploadedDocs: { type: string; name: string; url: string; uploadedAt: Date }[] = [];

      for (const doc of documents) {
        const path = `referee-verification/${user.uid}/${Date.now()}-${doc.file.name}`;
        const uploaded = await uploadFile(doc.file, path);
        uploadedDocs.push({
          type: doc.type,
          name: doc.name,
          url: uploaded.url,
          uploadedAt: new Date(),
        });
      }

      // Submit verification request
      await submitVerificationRequest({
        refereeId: user.uid,
        refereeName: userData.name,
        refereeEmail: userData.email || '',
        documents: uploadedDocs as any,
        certificationsClaimed: selectedCertifications,
      });

      setSuccess(true);
      setTimeout(() => {
        onComplete?.();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Referee Profile Required</h2>
        <p className="text-slate-400">Please complete your referee signup first.</p>
      </div>
    );
  }

  if (profile.verificationStatus === 'verified') {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Already Verified!</h2>
        <p className="text-slate-400">Your referee profile has been verified.</p>
      </div>
    );
  }

  if (profile.verificationStatus === 'pending') {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Verification Pending</h2>
        <p className="text-slate-400">Your verification request is being reviewed.</p>
        <p className="text-sm text-slate-500 mt-2">You'll be notified once a decision is made.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Request Submitted!</h2>
        <p className="text-slate-400">Your verification request has been submitted for review.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Get Verified</h2>
        <p className="text-slate-400">
          Upload documents to verify your officiating credentials and earn a verified badge
        </p>
      </div>

      {/* Benefits */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
        <h3 className="font-semibold text-green-400 mb-2">Benefits of Verification</h3>
        <ul className="text-sm text-slate-300 space-y-1">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Verified badge on your public profile
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Higher visibility in referee search
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Increased trust from league owners
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Access to premium assignment opportunities
          </li>
        </ul>
      </div>

      {/* Document Upload */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Upload Documents
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Upload copies of your certifications, ID, or background check results
        </p>

        {/* Document Type Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { type: 'certification', label: 'Certification', icon: Award },
            { type: 'id', label: 'Photo ID', icon: FileText },
            { type: 'background_check', label: 'Background Check', icon: Shield },
            { type: 'other', label: 'Other Document', icon: Plus },
          ].map(({ type, label, icon: Icon }) => (
            <label
              key={type}
              className="flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-lg cursor-pointer transition-colors"
            >
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => handleFileSelect(e, type as UploadedDocument['type'])}
                className="hidden"
              />
              <Icon className="w-5 h-5 text-slate-400" />
              <span className="text-slate-300">{label}</span>
            </label>
          ))}
        </div>

        {/* Uploaded Documents List */}
        {documents.length > 0 && (
          <div className="space-y-2 mt-4">
            <p className="text-sm text-slate-400">Uploaded Documents ({documents.length})</p>
            {documents.map((doc, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-white text-sm">{doc.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{doc.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeDocument(index)}
                  className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Select Certifications to Verify */}
      {profile.certifications && profile.certifications.length > 0 && (
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            Certifications to Verify
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Select which certifications you want verified (make sure to upload supporting documents)
          </p>
          <div className="space-y-2">
            {profile.certifications.map((cert, index) => {
              const isSelected = selectedCertifications.some(
                (c) => c.name === cert.name && c.sport === cert.sport
              );
              return (
                <button
                  key={index}
                  onClick={() => toggleCertification(cert)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-500'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{cert.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{cert.sport}</p>
                    </div>
                  </div>
                  {cert.organization && (
                    <span className="text-xs text-slate-500">{cert.organization}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || documents.length === 0}
          className="px-8 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Submit for Verification
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RefereeVerificationSubmit;
