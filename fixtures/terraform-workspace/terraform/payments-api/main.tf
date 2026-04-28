variable "image_tag" {
  type = string
}

variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "stage", "prod"], var.environment)
    error_message = "environment must be dev, stage, or prod."
  }
}

locals {
  image_tag   = var.image_tag
  environment = var.environment
}
