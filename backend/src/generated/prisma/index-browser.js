
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  passwordHash: 'passwordHash',
  role: 'role',
  refreshToken: 'refreshToken',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PosAdminScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  activeBranchId: 'activeBranchId',
  name: 'name',
  email: 'email',
  passwordHash: 'passwordHash',
  role: 'role',
  isActive: 'isActive',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PosCounterSaleScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  invoiceGroupCode: 'invoiceGroupCode',
  totalAmount: 'totalAmount',
  emptyDeduction: 'emptyDeduction',
  emptiesReturned: 'emptiesReturned',
  amountReceived: 'amountReceived',
  changeGiven: 'changeGiven',
  paymentMethod: 'paymentMethod',
  paymentReference: 'paymentReference',
  cashPaid: 'cashPaid',
  cardPaid: 'cardPaid',
  transferPaid: 'transferPaid',
  walletUsed: 'walletUsed',
  walletCredit: 'walletCredit',
  cashierId: 'cashierId',
  customerId: 'customerId',
  pointsEarned: 'pointsEarned',
  pointsRate: 'pointsRate',
  discountType: 'discountType',
  discountValue: 'discountValue',
  discountAmount: 'discountAmount',
  pointsRedeemed: 'pointsRedeemed',
  pointsValue: 'pointsValue',
  shiftId: 'shiftId',
  createdAt: 'createdAt'
};

exports.Prisma.SupplierScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  contactPerson: 'contactPerson',
  telephone: 'telephone',
  address: 'address',
  fax: 'fax',
  email: 'email',
  vatRegistrationNo: 'vatRegistrationNo',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventoryBrandScalarFieldEnum = {
  id: 'id',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventoryCategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventoryProductScalarFieldEnum = {
  id: 'id',
  displayId: 'displayId',
  brandId: 'brandId',
  categoryId: 'categoryId',
  supplierId: 'supplierId',
  name: 'name',
  partNumber: 'partNumber',
  compatibleWith: 'compatibleWith',
  quantity: 'quantity',
  soldQuantity: 'soldQuantity',
  lowStockThreshold: 'lowStockThreshold',
  purchasePrice: 'purchasePrice',
  taxPaid: 'taxPaid',
  additionalExpenses: 'additionalExpenses',
  sellingPrice: 'sellingPrice',
  emptyBottlePrice: 'emptyBottlePrice',
  emptyBottlesOnHand: 'emptyBottlesOnHand',
  isHardLiquor: 'isHardLiquor',
  damagedQuantity: 'damagedQuantity',
  description: 'description',
  lastSoldAt: 'lastSoldAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventoryProductExpenseScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  description: 'description',
  amount: 'amount',
  createdAt: 'createdAt'
};

exports.Prisma.InventoryProductImageScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  url: 'url',
  isPrimary: 'isPrimary',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt'
};

exports.Prisma.PosCustomerScalarFieldEnum = {
  id: 'id',
  firstName: 'firstName',
  lastName: 'lastName',
  nic: 'nic',
  mobileNumber: 'mobileNumber',
  email: 'email',
  province: 'province',
  district: 'district',
  address: 'address',
  loyaltyPoints: 'loyaltyPoints',
  totalSpent: 'totalSpent',
  visits: 'visits',
  lastVisitAt: 'lastVisitAt',
  walletBalance: 'walletBalance',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PosCustomerPurchaseScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  itemType: 'itemType',
  purchaseMode: 'purchaseMode',
  invoiceGroupCode: 'invoiceGroupCode',
  inventoryProductId: 'inventoryProductId',
  customCategory: 'customCategory',
  customDescription: 'customDescription',
  currentSellingPrice: 'currentSellingPrice',
  finalSellingPrice: 'finalSellingPrice',
  paymentType: 'paymentType',
  downPaymentAmount: 'downPaymentAmount',
  remainingAmount: 'remainingAmount',
  settlementStatus: 'settlementStatus',
  purchaseChannel: 'purchaseChannel',
  extraCosts: 'extraCosts',
  interestRate: 'interestRate',
  installmentMonths: 'installmentMonths',
  monthlyInstallmentAmount: 'monthlyInstallmentAmount',
  totalWithInterest: 'totalWithInterest',
  quantity: 'quantity',
  emptiesReturned: 'emptiesReturned',
  emptyDeduction: 'emptyDeduction',
  isHardLiquor: 'isHardLiquor',
  billDiscount: 'billDiscount',
  purchasedAt: 'purchasedAt'
};

exports.Prisma.PosInvoiceTermScalarFieldEnum = {
  id: 'id',
  text: 'text',
  termType: 'termType',
  sortOrder: 'sortOrder',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PosInstallmentScalarFieldEnum = {
  id: 'id',
  purchaseId: 'purchaseId',
  installmentNo: 'installmentNo',
  dueDate: 'dueDate',
  dueAmount: 'dueAmount',
  paidAmount: 'paidAmount',
  isPartial: 'isPartial',
  penaltyRate: 'penaltyRate',
  penaltyAmount: 'penaltyAmount',
  status: 'status',
  settledAt: 'settledAt',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PosInstallmentPaymentScalarFieldEnum = {
  id: 'id',
  installmentId: 'installmentId',
  amount: 'amount',
  penaltyAmount: 'penaltyAmount',
  note: 'note',
  paidAt: 'paidAt'
};

exports.Prisma.ContactRequestScalarFieldEnum = {
  id: 'id',
  displayId: 'displayId',
  name: 'name',
  email: 'email',
  phone: 'phone',
  city: 'city',
  interests: 'interests',
  message: 'message',
  status: 'status',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  type: 'type',
  level: 'level',
  openingBalance: 'openingBalance',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountRelationshipScalarFieldEnum = {
  mainAccountId: 'mainAccountId',
  subAccountId: 'subAccountId',
  createdAt: 'createdAt'
};

exports.Prisma.AccountReceiptScalarFieldEnum = {
  id: 'id',
  receiptNo: 'receiptNo',
  purchaseId: 'purchaseId',
  accountId: 'accountId',
  amount: 'amount',
  paymentMethod: 'paymentMethod',
  chequeNo: 'chequeNo',
  chequeBank: 'chequeBank',
  chequeDate: 'chequeDate',
  chequeStatus: 'chequeStatus',
  description: 'description',
  isVoided: 'isVoided',
  isDeposited: 'isDeposited',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountVoucherScalarFieldEnum = {
  id: 'id',
  voucherNo: 'voucherNo',
  accountId: 'accountId',
  toAccountId: 'toAccountId',
  type: 'type',
  amount: 'amount',
  description: 'description',
  payee: 'payee',
  paymentDate: 'paymentDate',
  referenceNo: 'referenceNo',
  isVoided: 'isVoided',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountTransactionScalarFieldEnum = {
  id: 'id',
  accountId: 'accountId',
  type: 'type',
  direction: 'direction',
  amount: 'amount',
  receiptId: 'receiptId',
  voucherId: 'voucherId',
  depositId: 'depositId',
  refNo: 'refNo',
  description: 'description',
  chequeNo: 'chequeNo',
  isReversal: 'isReversal',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.InvoicePaymentScalarFieldEnum = {
  id: 'id',
  purchaseId: 'purchaseId',
  amount: 'amount',
  paymentMethod: 'paymentMethod',
  chequeNo: 'chequeNo',
  chequeBank: 'chequeBank',
  chequeDate: 'chequeDate',
  description: 'description',
  paidAt: 'paidAt',
  receiptId: 'receiptId'
};

exports.Prisma.AccountDepositScalarFieldEnum = {
  id: 'id',
  depositNo: 'depositNo',
  accountId: 'accountId',
  subAccountId: 'subAccountId',
  totalAmount: 'totalAmount',
  notes: 'notes',
  isReversed: 'isReversed',
  reversedAt: 'reversedAt',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.AccountDepositItemScalarFieldEnum = {
  id: 'id',
  depositId: 'depositId',
  receiptId: 'receiptId',
  amount: 'amount'
};

exports.Prisma.ActivityLogScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  actorId: 'actorId',
  actorName: 'actorName',
  actorEmail: 'actorEmail',
  actorRole: 'actorRole',
  action: 'action',
  category: 'category',
  summary: 'summary',
  entityType: 'entityType',
  entityId: 'entityId',
  details: 'details',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.PosSettingScalarFieldEnum = {
  key: 'key',
  value: 'value',
  updatedById: 'updatedById',
  updatedAt: 'updatedAt'
};

exports.Prisma.PosShiftScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  shiftNo: 'shiftNo',
  status: 'status',
  openedById: 'openedById',
  openedAt: 'openedAt',
  openingFloat: 'openingFloat',
  countedCash: 'countedCash',
  denominations: 'denominations',
  countedById: 'countedById',
  countedAt: 'countedAt',
  expectedCash: 'expectedCash',
  cashDifference: 'cashDifference',
  differenceReason: 'differenceReason',
  cardSlipTotal: 'cardSlipTotal',
  cardDifferenceReason: 'cardDifferenceReason',
  floatLeft: 'floatLeft',
  cashBanked: 'cashBanked',
  closedById: 'closedById',
  closedAt: 'closedAt',
  notes: 'notes',
  report: 'report'
};

exports.Prisma.PosCashEntryScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  entryNo: 'entryNo',
  direction: 'direction',
  category: 'category',
  amount: 'amount',
  source: 'source',
  party: 'party',
  reference: 'reference',
  note: 'note',
  entryDate: 'entryDate',
  shiftId: 'shiftId',
  automatic: 'automatic',
  createdById: 'createdById',
  createdAt: 'createdAt',
  voided: 'voided',
  voidReason: 'voidReason',
  voidedById: 'voidedById',
  voidedAt: 'voidedAt',
  bankStatus: 'bankStatus',
  bankedAt: 'bankedAt',
  bankedById: 'bankedById',
  bankReference: 'bankReference'
};

exports.Prisma.InventoryMovementScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  productId: 'productId',
  kind: 'kind',
  type: 'type',
  quantity: 'quantity',
  shiftId: 'shiftId',
  reference: 'reference',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.PurchaseOrderScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  poNumber: 'poNumber',
  supplierId: 'supplierId',
  status: 'status',
  orderDate: 'orderDate',
  expectedDate: 'expectedDate',
  notes: 'notes',
  total: 'total',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  sentAt: 'sentAt',
  sentById: 'sentById',
  receivedAt: 'receivedAt',
  receivedById: 'receivedById',
  cancelledAt: 'cancelledAt',
  cancelledById: 'cancelledById',
  cancelReason: 'cancelReason'
};

exports.Prisma.PurchaseOrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  productId: 'productId',
  description: 'description',
  quantity: 'quantity',
  unitCost: 'unitCost',
  lineTotal: 'lineTotal',
  receivedQty: 'receivedQty',
  freeQty: 'freeQty',
  freeReceived: 'freeReceived'
};

exports.Prisma.PurchaseOrderEmailScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  toEmail: 'toEmail',
  ccEmail: 'ccEmail',
  subject: 'subject',
  message: 'message',
  status: 'status',
  error: 'error',
  messageId: 'messageId',
  sentById: 'sentById',
  createdAt: 'createdAt'
};

exports.Prisma.PosWalletTransactionScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  type: 'type',
  amount: 'amount',
  balanceAfter: 'balanceAfter',
  invoiceGroupCode: 'invoiceGroupCode',
  shiftId: 'shiftId',
  note: 'note',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.PosReturnScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  returnNo: 'returnNo',
  type: 'type',
  productId: 'productId',
  productName: 'productName',
  quantity: 'quantity',
  condition: 'condition',
  invoiceGroupCode: 'invoiceGroupCode',
  customerId: 'customerId',
  customerName: 'customerName',
  customerMobile: 'customerMobile',
  unitPrice: 'unitPrice',
  refundAmount: 'refundAmount',
  refundMethod: 'refundMethod',
  pointsReversed: 'pointsReversed',
  unitCost: 'unitCost',
  reason: 'reason',
  note: 'note',
  disposal: 'disposal',
  reference: 'reference',
  shiftId: 'shiftId',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.BranchScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  address: 'address',
  phone: 'phone',
  email: 'email',
  isMain: 'isMain',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BranchStockScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  productId: 'productId',
  quantity: 'quantity',
  damagedQuantity: 'damagedQuantity',
  emptyBottlesOnHand: 'emptyBottlesOnHand',
  updatedAt: 'updatedAt'
};

exports.Prisma.GrnScalarFieldEnum = {
  id: 'id',
  grnNo: 'grnNo',
  branchId: 'branchId',
  supplierId: 'supplierId',
  supplierName: 'supplierName',
  purchaseOrderId: 'purchaseOrderId',
  poNumber: 'poNumber',
  supplierInvoiceNo: 'supplierInvoiceNo',
  invoiceDate: 'invoiceDate',
  invoiceTotal: 'invoiceTotal',
  notes: 'notes',
  acceptedUnits: 'acceptedUnits',
  rejectedUnits: 'rejectedUnits',
  freeUnits: 'freeUnits',
  freeValue: 'freeValue',
  totalCost: 'totalCost',
  shiftId: 'shiftId',
  receivedById: 'receivedById',
  createdAt: 'createdAt'
};

exports.Prisma.GrnItemScalarFieldEnum = {
  id: 'id',
  grnId: 'grnId',
  productId: 'productId',
  description: 'description',
  purchaseOrderItemId: 'purchaseOrderItemId',
  orderedQty: 'orderedQty',
  deliveredQty: 'deliveredQty',
  acceptedQty: 'acceptedQty',
  rejectedQty: 'rejectedQty',
  rejectReason: 'rejectReason',
  freeQty: 'freeQty',
  unitCost: 'unitCost',
  lineTotal: 'lineTotal'
};

exports.Prisma.GtnScalarFieldEnum = {
  id: 'id',
  gtnNo: 'gtnNo',
  fromBranchId: 'fromBranchId',
  toBranchId: 'toBranchId',
  status: 'status',
  notes: 'notes',
  carriedBy: 'carriedBy',
  sentById: 'sentById',
  sentAt: 'sentAt',
  sentShiftId: 'sentShiftId',
  receivedById: 'receivedById',
  receivedAt: 'receivedAt',
  receivedShiftId: 'receivedShiftId',
  receiveNote: 'receiveNote',
  cancelledById: 'cancelledById',
  cancelledAt: 'cancelledAt',
  cancelReason: 'cancelReason'
};

exports.Prisma.GtnItemScalarFieldEnum = {
  id: 'id',
  gtnId: 'gtnId',
  productId: 'productId',
  productName: 'productName',
  sentQty: 'sentQty',
  receivedQty: 'receivedQty',
  damagedQty: 'damagedQty',
  missingQty: 'missingQty',
  unitCost: 'unitCost'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.Role = exports.$Enums.Role = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER'
};

exports.PosAdminRole = exports.$Enums.PosAdminRole = {
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT'
};

exports.PaymentMethod = exports.$Enums.PaymentMethod = {
  CASH: 'CASH',
  CHEQUE: 'CHEQUE',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD: 'CARD',
  SPLIT: 'SPLIT'
};

exports.PosPurchaseItemType = exports.$Enums.PosPurchaseItemType = {
  INVENTORY: 'INVENTORY',
  CUSTOM: 'CUSTOM'
};

exports.PosPurchaseMode = exports.$Enums.PosPurchaseMode = {
  SINGLE: 'SINGLE',
  BULK: 'BULK'
};

exports.PosPaymentType = exports.$Enums.PosPaymentType = {
  DIRECT: 'DIRECT',
  DOWNPAYMENT: 'DOWNPAYMENT'
};

exports.PosSettlementStatus = exports.$Enums.PosSettlementStatus = {
  SETTLED: 'SETTLED',
  TO_SETTLE: 'TO_SETTLE'
};

exports.PosPurchaseChannel = exports.$Enums.PosPurchaseChannel = {
  PERSONAL: 'PERSONAL'
};

exports.InvoiceTermType = exports.$Enums.InvoiceTermType = {
  ADVANCE: 'ADVANCE',
  FINAL: 'FINAL'
};

exports.InstallmentStatus = exports.$Enums.InstallmentStatus = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID'
};

exports.AccountType = exports.$Enums.AccountType = {
  BANK: 'BANK',
  CASH: 'CASH'
};

exports.AccountLevel = exports.$Enums.AccountLevel = {
  MAIN: 'MAIN',
  SUB: 'SUB'
};

exports.ChequeStatus = exports.$Enums.ChequeStatus = {
  PENDING: 'PENDING',
  CLEARED: 'CLEARED',
  BOUNCED: 'BOUNCED'
};

exports.VoucherType = exports.$Enums.VoucherType = {
  BILL: 'BILL',
  OTHER_PAYMENT: 'OTHER_PAYMENT',
  PERMIT: 'PERMIT',
  LOAN_PAYMENT: 'LOAN_PAYMENT',
  SALARY: 'SALARY',
  CUSTOMER_REFUND: 'CUSTOMER_REFUND',
  ADVANCE_REFUND: 'ADVANCE_REFUND',
  ACCOUNT_TRANSFER: 'ACCOUNT_TRANSFER'
};

exports.TransactionType = exports.$Enums.TransactionType = {
  RECEIPT: 'RECEIPT',
  VOUCHER: 'VOUCHER',
  REVERSAL: 'REVERSAL',
  DEPOSIT: 'DEPOSIT',
  TRANSFER: 'TRANSFER'
};

exports.TransactionDirection = exports.$Enums.TransactionDirection = {
  DR: 'DR',
  CR: 'CR'
};

exports.Prisma.ModelName = {
  User: 'User',
  PosAdmin: 'PosAdmin',
  PosCounterSale: 'PosCounterSale',
  Supplier: 'Supplier',
  InventoryBrand: 'InventoryBrand',
  InventoryCategory: 'InventoryCategory',
  InventoryProduct: 'InventoryProduct',
  InventoryProductExpense: 'InventoryProductExpense',
  InventoryProductImage: 'InventoryProductImage',
  PosCustomer: 'PosCustomer',
  PosCustomerPurchase: 'PosCustomerPurchase',
  PosInvoiceTerm: 'PosInvoiceTerm',
  PosInstallment: 'PosInstallment',
  PosInstallmentPayment: 'PosInstallmentPayment',
  ContactRequest: 'ContactRequest',
  Account: 'Account',
  AccountRelationship: 'AccountRelationship',
  AccountReceipt: 'AccountReceipt',
  AccountVoucher: 'AccountVoucher',
  AccountTransaction: 'AccountTransaction',
  InvoicePayment: 'InvoicePayment',
  AccountDeposit: 'AccountDeposit',
  AccountDepositItem: 'AccountDepositItem',
  ActivityLog: 'ActivityLog',
  PosSetting: 'PosSetting',
  PosShift: 'PosShift',
  PosCashEntry: 'PosCashEntry',
  InventoryMovement: 'InventoryMovement',
  PurchaseOrder: 'PurchaseOrder',
  PurchaseOrderItem: 'PurchaseOrderItem',
  PurchaseOrderEmail: 'PurchaseOrderEmail',
  PosWalletTransaction: 'PosWalletTransaction',
  PosReturn: 'PosReturn',
  Branch: 'Branch',
  BranchStock: 'BranchStock',
  Grn: 'Grn',
  GrnItem: 'GrnItem',
  Gtn: 'Gtn',
  GtnItem: 'GtnItem'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
