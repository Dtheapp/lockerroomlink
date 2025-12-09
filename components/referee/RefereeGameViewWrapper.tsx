/**
 * OSYS Referee Game View Wrapper
 * Extracts route params and passes to RefereeGameView
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefereeGameView } from './RefereeGameView';

export const RefereeGameViewWrapper: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  if (!assignmentId) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Invalid game assignment</p>
      </div>
    );
  }

  return (
    <RefereeGameView
      assignmentId={assignmentId}
      onBack={() => navigate('/referee/schedule')}
    />
  );
};

export default RefereeGameViewWrapper;
