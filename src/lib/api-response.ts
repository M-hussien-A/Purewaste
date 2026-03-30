import { NextResponse } from 'next/server';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export function successResponse<T>(
  data: T,
  meta?: PaginationMeta
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta && { meta }),
    },
    { status: 200 }
  );
}

export function errorResponse(
  code: string,
  message: string,
  details?: unknown,
  status: number = 400
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

export function paginatedResponse<T>(
  data: T,
  page: number,
  limit: number,
  total: number
): NextResponse<ApiResponse<T>> {
  const totalPages = Math.ceil(total / limit);
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    { status: 200 }
  );
}
