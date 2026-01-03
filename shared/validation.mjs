export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/;
export const passwordRegexChecklist = {
    length: /^.{8,}$/,
    numbers: /\d/,
    letters: /(?=.*[a-z])(?=.*[A-Z])/
};
export const requiredShippingAddressFields = ['prename', 'lastname', 'street', 'streetnumber', 'zip', 'city', 'country'];
export const requiredShippingAddressFieldsServer = ['prename', 'lastname', 'line1', 'zip', 'city', 'country'];
// export const requiredShippingAddressFields = ['prename', 'lastname', 'street', 'streetnumber', 'zip', 'city', 'country'];


export const validateEmail = (email) => {
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return passwordRegex.test(password);
};

export const isEmptyOrNull = (value) => {
  return value === null || value === undefined || value === '';
}