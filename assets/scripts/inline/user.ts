import {getLocalUser} from '../lib/local-storage.ts';

const checkUserState = async () => {
  const user = getLocalUser();

  // if (user) {
  //   console.log('User is logged in:', user);
  // } else {
  //   console.log('No user logged in');;
  // }
  const visibleClass = `nav-auth-logged-${user ? 'in' : 'out'}`
  const hiddenClass = `nav-auth-logged-${user ? 'out' : 'in'}`
  document.getElementById(visibleClass)?.classList.remove('hidden');
  document.getElementById(hiddenClass)?.classList.add('hidden');
}

// document.addEventListener('DOMContentLoaded', async function () {
//   await checkUserState();
// });
checkUserState();

document.addEventListener("visibilitychange", function() {
  if (!document.hidden) {
    checkUserState();
  }
});