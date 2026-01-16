declare const grecaptcha: any;

export const getCaptchaTocken = async (action: string): Promise<string | undefined> => {
  const data = document.getElementById('captcha-site-key');
  const captchaSiteKey = data?.dataset.captchaSiteKey;

  if (!captchaSiteKey) return undefined;
  try {
    return await grecaptcha.execute(captchaSiteKey, { action });
  }
  catch (err) {
    console.error("Recaptcha error", err);
    return undefined;
  }
}
