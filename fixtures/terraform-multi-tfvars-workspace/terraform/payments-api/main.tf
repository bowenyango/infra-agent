variable "image_tag" {
  type = string
}

variable "environment" {
  type = string
}

locals {
  deployment_image_tag = var.image_tag
  deployment_environment = var.environment
}
