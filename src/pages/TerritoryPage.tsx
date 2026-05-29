import { Navigate } from 'react-router-dom';

/** @deprecated Используйте /information */
export function TerritoryPage() {
  return <Navigate to="/information" replace />;
}
