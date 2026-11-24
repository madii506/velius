// the vault's state, as the site shows it. Closed until it is funded, tested live on mainnet and switched on.
const L = require('./_lib');
module.exports = (req, res) => {
  const open = L.VAULT();
  L.send(res, 200, {
    open,
    address: open ? process.env.VAULT_ADDRESS : null,
    maxLeverage: 20,
    reason: open ? null : 'The vault opens once it is funded and has passed a live test on mainnet.',
    at: Date.now(),
  }, 'public, max-age=15');
};
