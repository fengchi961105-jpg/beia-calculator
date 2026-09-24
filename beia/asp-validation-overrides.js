// ASP validation refresh from the 2026-09-24 business parameter sheet.
(function applyAspValidationOverrides(root) {
  const products = root.BEIA_PRODUCT_DEFAULTS;
  if (!products) return;

  const patchRows = (productId, rows) => {
    rows.forEach(([gradeIndex, asp, couplingAsp]) => {
      const row = products[productId]?.[gradeIndex];
      if (!row) return;
      row.asp = asp;
      if (couplingAsp !== undefined) row.cASP = couplingAsp;
    });
  };

  patchRows("26秋下12", [
    [0, 949],
    [1, 949, 799],
  ]);
  patchRows("26秋下9", [
    [2, 836, 793],
    [3, 836, 793],
    [4, 836, 793],
    [5, 836, 793],
  ]);
})(globalThis);
