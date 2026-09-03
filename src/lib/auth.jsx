// TODO(Task 4): remplacer par la vraie implémentation
import { createContext } from 'react';

export const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  return children;
}
