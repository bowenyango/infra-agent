variable "app_image_tag" {
  type = string
}

variable "deploy_env" {
  type = string
}

locals {
  image_tag = var.app_image_tag
  env_name  = var.deploy_env
}
