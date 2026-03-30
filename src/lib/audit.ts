import prisma from './prisma';
import { AuditAction } from '@prisma/client';

export async function logAction(params: {
  userId: string;
  action: AuditAction;
  module: string;
  recordId?: string;
  oldValue?: object;
  newValue?: object;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      module: params.module,
      recordId: params.recordId,
      oldValue: params.oldValue as any,
      newValue: params.newValue as any,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}
