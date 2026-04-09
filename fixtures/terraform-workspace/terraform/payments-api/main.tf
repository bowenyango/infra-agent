variable "image_tag" {
  type = string
}

variable "environment" {
  type = string
}

locals {
  image_tag   = var.image_tag
  environment = var.environment
}
