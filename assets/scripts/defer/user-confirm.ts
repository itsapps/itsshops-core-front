import { confirmUser } from '../lib/api';
import {setLocalUser} from '../lib/local-storage';
import {retryHandler} from '../lib/error-handler';
import { AuthError } from '../lib/browser-errors';

(async () => {
  const url = new URL(window.location.href);
	const params = url.searchParams;
  const accessToken = params.get("token_hash");
  
  if (!accessToken) {
    window.location.href = `/${document.documentElement.lang}`
    return;
  }

  const retryErrorHandler = retryHandler(
    () => confirmUser(accessToken), {
      successHandler: (data) => {
        setLocalUser(data.user);
      },
      errorHandler: (error, buttonId) => {
        if (error instanceof AuthError) {
          if (error.meta.expired) {
            if (buttonId) {
              document.getElementById(buttonId + '-container')?.classList.add('hidden');
            }
            document.getElementById('auth-error-invalid')?.classList.remove('hidden');
          }
        }
      },
      replaceRedirect: true
    }
  );
  // await retryErrorHandler.doAction();
})();