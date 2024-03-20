import { BaseErrorContent } from "exceptions/base-error.exception";

type Pagination = {
  page: number;
  totalPage: number;
  nextPage: number | null;
};

export default class BaseResponse<T> {
  public message?: string;
  public error: BaseErrorContent | null;
  public data: T;
  public pagination?: Pagination;

  constructor(params: {
    message?: string;
    data: T;
    error: BaseErrorContent | null;
    pagination?: Pagination;
  }) {
    this.message = params.message || undefined;
    this.data = params.data;
    this.error = params.error;
    this.pagination = params.pagination;
  }

  public static getPagination(paginationRequest: {
    page: number;
    perPage: number;
    total: number;
  }) {
    return {
      page: paginationRequest.page,
      totalPage: Math.ceil(paginationRequest.total / paginationRequest.perPage),
      nextPage:
        paginationRequest.page * paginationRequest.perPage <
        paginationRequest.total
          ? paginationRequest.page + 1
          : null,
    };
  }

  public static success<T>(
    data: T,
    paginationRequest?: {
      page: number;
      perPage: number;
      total: number;
    },
  ) {
    return new BaseResponse<T>({
      data,
      error: null,
      pagination: paginationRequest
        ? this.getPagination(paginationRequest)
        : undefined,
    });
  }

  public static error(error: BaseErrorContent) {
    return new BaseResponse<null>({
      data: null,
      error: error,
    });
  }
}
