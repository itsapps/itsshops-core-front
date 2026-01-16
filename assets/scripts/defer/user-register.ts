import { registerUser } from '../lib/api.ts';
import { validateForm } from '../lib/form-validation.ts';
import { formHandler } from '../lib/error-handler.ts';
import { getCaptchaTocken } from '../lib/captcha.ts';
import { showToast } from '../lib/utils.ts';
import {
  RegisterUserInputPayload,
} from '../../../../shared/shared_types.mts';


(async () => {;
  const register = async ({email, password, registerForNewsletter}: {email: string, password: string, registerForNewsletter?: boolean}) => {
    const recaptchaToken = await getCaptchaTocken("register");
    if (!recaptchaToken) {
      showToast("Captcha verification failed", 5*1000);
      return
      // throw new Error("Captcha verification failed");
    }

    const payload: RegisterUserInputPayload = {
      email,
      password,
      registerForNewsletter: registerForNewsletter !== undefined,
      captchaToken: recaptchaToken
    }
    return await formHandler(
      () => registerUser(payload)
    );
  };
  
  validateForm("registration-form", register);
})();