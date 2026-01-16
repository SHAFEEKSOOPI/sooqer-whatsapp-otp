const store = new Map();

exports.saveOtp = (phone, otp) => {
  store.set(phone, {
    otp,
    expires: Date.now() + 5 * 60 * 1000 // 5 minutes
  });
};

exports.verifyOtp = (phone, otp) => {
  const data = store.get(phone);
  if (!data) return false;
  if (Date.now() > data.expires) return false;
  if (data.otp !== otp) return false;
  store.delete(phone);
  return true;
};
