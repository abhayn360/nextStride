import { useEffect } from 'react';

import { Banner } from '@/components/ui';
import { useAuthStore } from '@/store/auth.store';

/** Shows (once) why the user was signed out — e.g. an expired session. */
export function SessionNotice() {
  const notice = useAuthStore((state) => state.notice);
  const dismiss = useAuthStore((state) => state.dismissNotice);

  // Clear it when the screen goes away so it isn't shown again later.
  useEffect(() => dismiss, [dismiss]);

  return notice ? <Banner tone="info" message={notice} /> : null;
}
