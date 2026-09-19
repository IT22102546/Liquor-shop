DELETE FROM "pos_invoice_accounts"
WHERE "accountHolder" = 'JL Racing'
   OR ("bankName" = 'HNB' AND "accountNumber" = '019010033205');