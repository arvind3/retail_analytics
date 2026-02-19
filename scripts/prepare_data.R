options(repos = c(CRAN = "https://cloud.r-project.org"))

install_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    install.packages(pkg)
  }
}

install_if_missing("completejourney")
install_if_missing("dplyr")
install_if_missing("tibble")
install_if_missing("jsonlite")
install_if_missing("arrow")

suppressPackageStartupMessages({
  library(completejourney)
  library(dplyr)
  library(tibble)
  library(jsonlite)
})

has_arrow <- requireNamespace("arrow", quietly = TRUE)
if (!has_arrow) {
  install_if_missing("nanoparquet")
}

write_parquet_file <- function(tbl, out_path) {
  if (has_arrow) {
    arrow::write_parquet(tbl, out_path, compression = "zstd")
  } else {
    nanoparquet::write_parquet(tbl, out_path)
  }
}

out_dir <- file.path("data", "parquet")
if (!dir.exists(out_dir)) {
  dir.create(out_dir, recursive = TRUE)
}

slice_weeks <- Sys.getenv("CJ_SLICE_WEEKS", unset = "")
if (slice_weeks != "") {
  slice_weeks <- as.integer(slice_weeks)
} else {
  slice_weeks <- NULL
}

slice_rows <- Sys.getenv("CJ_SLICE_ROWS", unset = "")
if (slice_rows != "") {
  slice_rows <- as.integer(slice_rows)
} else {
  slice_rows <- NULL
}

data_items <- data(package = "completejourney")$results[, "Item"]

name_map <- list(
  demographics = "households",
  transactions_sample = "transactions",
  campaign_desc = "campaign_descriptions"
)

metadata_tables <- list()

for (item in data_items) {
  env <- new.env()
  data(list = item, package = "completejourney", envir = env)
  obj <- env[[item]]

  if (!is.data.frame(obj)) {
    next
  }

  tbl <- as_tibble(obj)
  out_name <- if (!is.null(name_map[[item]])) name_map[[item]] else item

  if (out_name %in% names(metadata_tables) && item == "transactions_sample") {
    next
  }

  if (out_name %in% names(metadata_tables) && item == "campaign_desc") {
    next
  }

  if (out_name == "transactions" && "transaction_timestamp" %in% names(tbl)) {
    tbl <- tbl %>%
      mutate(transaction_date = as.Date(transaction_timestamp))
    if (!"week" %in% names(tbl)) {
      tbl <- tbl %>%
        mutate(week = as.integer(format(transaction_date, "%U")) + 1)
    }
    if (!"day" %in% names(tbl)) {
      min_date <- min(tbl$transaction_date, na.rm = TRUE)
      tbl <- tbl %>%
        mutate(day = as.integer(difftime(transaction_date, min_date, units = "days")))
    }
  }

  if (!is.null(slice_rows) && out_name == "transactions") {
    tbl <- tbl %>% slice_head(n = slice_rows)
  }

  if (!is.null(slice_weeks) && out_name == "transactions" && "week" %in% names(tbl)) {
    max_week <- max(tbl$week, na.rm = TRUE)
    tbl <- tbl %>% filter(week >= (max_week - slice_weeks))
  }

  out_path <- file.path(out_dir, paste0(out_name, ".parquet"))
  write_parquet_file(tbl, out_path)

  columns <- lapply(names(tbl), function(col) {
    list(name = col, type = class(tbl[[col]])[1])
  })

  date_cols <- names(tbl)[sapply(tbl, function(col) inherits(col, c("Date", "POSIXct", "POSIXt")))]
  min_date <- NULL
  max_date <- NULL
  if (length(date_cols) > 0) {
    date_values <- unlist(lapply(date_cols, function(col) as.Date(tbl[[col]])))
    min_date <- as.character(min(date_values, na.rm = TRUE))
    max_date <- as.character(max(date_values, na.rm = TRUE))
  }

  info <- file.info(out_path)
  metadata_tables[[out_name]] <- list(
    rows = nrow(tbl),
    bytes = as.numeric(info$size),
    columns = columns,
    min_date = min_date,
    max_date = max_date
  )
}

metadata <- list(
  generated_at = as.character(Sys.time()),
  source = paste0("completejourney ", as.character(packageVersion("completejourney"))),
  tables = metadata_tables,
  total_bytes = sum(sapply(metadata_tables, function(x) x$bytes))
)

write_json(metadata, file.path("data", "metadata.json"), pretty = TRUE, auto_unbox = TRUE)

# Sync to public/data for Vite static serving
public_dir <- file.path("public", "data")
parquet_public <- file.path(public_dir, "parquet")
if (dir.exists(public_dir)) {
  unlink(public_dir, recursive = TRUE)
}
dir.create(parquet_public, recursive = TRUE)

file.copy(file.path("data", "metadata.json"), file.path(public_dir, "metadata.json"), overwrite = TRUE)
parquet_files <- list.files(out_dir, full.names = TRUE)
if (length(parquet_files) > 0) {
  file.copy(parquet_files, parquet_public, overwrite = TRUE)
}
