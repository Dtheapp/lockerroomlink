// Playbook.tsx - Now uses the new TeamPlaybook component
// The play designer has been moved to the coach's profile (CoachPlaybook)
// This file is now a simple wrapper for backward compatibility

import React from 'react';
import TeamPlaybook from './TeamPlaybook';

const Playbook: React.FC = () => {
  return <TeamPlaybook />;
};

export default Playbook;
