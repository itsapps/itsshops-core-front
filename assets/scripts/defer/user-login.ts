import { loginUser } from '../lib/api.ts';
import { validateForm } from '../lib/form-validation.ts';
import { formHandler } from '../lib/error-handler.ts';
import { setLocalUser } from '../lib/local-storage.ts';

const next = new URL(window.location.href).searchParams.get("next")
const login = async ({email, password}: {email: string, password: string}) => {
  return await formHandler(
    () => loginUser(email, password), {
      successHandler: (data) => {
        setLocalUser(data.user);
        if (next) {
          window.location.href = decodeURIComponent(next);
          return;
        }
        // window.location.reload();
        window.location.href = `/${document.documentElement.lang}`
      },
      // errorHandler: (error) => {
      //   console.log(error)
      // }
    }
  );
};

validateForm("login-form", login);