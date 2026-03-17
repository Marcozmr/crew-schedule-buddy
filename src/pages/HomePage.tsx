/**
 * HomePage — redirects to the EFB Dashboard.
 * The old grid menu is replaced by the professional dashboard.
 */

import { Navigate } from 'react-router-dom';

export default function HomePage() {
  return <Navigate to="/dashboard" replace />;
}
