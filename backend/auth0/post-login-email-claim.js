exports.onExecutePostLogin = async (event, api) => {
  if (event.user.email) {
    api.accessToken.setCustomClaim(
      'https://kindredlink.example/email',
      event.user.email,
    );
  }
};
