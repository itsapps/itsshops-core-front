import { recoverUserPassword } from '../lib/api.ts';
import { formHandler } from '../lib/error-handler.ts';
import { validateForm } from '../lib/form-validation.ts';
import {deleteLocalUser} from '../lib/local-storage.ts';
import { getCaptchaTocken } from '../lib/captcha.ts';
import { showToast } from '../lib/utils.ts';

declare const grecaptcha: any;

(async () => {
  const recoverPassword = async ({email}: {email: string}) => {
    const recaptchaToken = await getCaptchaTocken("register");
    if (!recaptchaToken) {
      showToast("Captcha verification failed", 5*1000);
      return
    }

    return await formHandler(
      () => recoverUserPassword(email, recaptchaToken), {
        successHandler: (data) => {
          deleteLocalUser();
        }
      }
    );
  };

  validateForm("recover-form", recoverPassword);
})();