import { resetUserPassword } from '../lib/api.ts';
import { formHandler } from '../lib/error-handler.ts';
import { validateForm } from '../lib/form-validation.ts';
import { deleteLocalUser } from '../lib/local-storage.ts';

(() => {
  const url = new URL(window.location.href);
	const params = url.searchParams;
  const accessToken = params.get("token_hash");
  const type = params.get("type"); // Get invite type if present
  // redirect to home if no token
  if (!accessToken) {
    window.location.href = `/${document.documentElement.lang}`
    return;
  }

  const resetPassword = async ({password}: {password: string}) => {
    // delete local storage user immediately
    deleteLocalUser();

    return await formHandler(
      () => resetUserPassword(accessToken, password, type)
    );
  };

  validateForm("reset-form", resetPassword);
})();