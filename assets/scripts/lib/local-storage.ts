import { ExposedUser } from '../../../../shared/shared_types.mjs';
import { LocalVoucher } from './client_types';

export const getLocalUser = (): ExposedUser | null => {
  const localUserString = localStorage.getItem('user')
  if (localUserString) {
    return JSON.parse(localUserString)
  }

  return null
}
export const deleteLocalUser = () => {
  localStorage.removeItem('user');
}
export const setLocalUser = (user: ExposedUser) => {
  localStorage.setItem('user', JSON.stringify(user));
}

export const getLocalVouchers = (): LocalVoucher[] => {
  const localVoucherCodes = localStorage.getItem('vouchers')
  if (localVoucherCodes) {
    return JSON.parse(localVoucherCodes)
  }

  return []
}
export const deleteLocalVouchers = () => {
  localStorage.removeItem('vouchers');
}
export const setLocalVouchers = (vouchers: LocalVoucher[]) => {
  localStorage.setItem('vouchers', JSON.stringify(vouchers));
}

export const getLocalSearchIds = (): string[] => {
  const ids = localStorage.getItem('search')
  if (ids) {
    return JSON.parse(ids)
  }

  return []
}
export const deleteLocalSearchIds = () => {
  localStorage.removeItem('search');
}
export const setLocalSearchIds = (ids: string[]) => {
  localStorage.setItem('search', JSON.stringify(ids));
}