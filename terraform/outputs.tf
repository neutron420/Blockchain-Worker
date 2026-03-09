output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "cloudwatch_log_group" {
  value = aws_cloudwatch_log_group.app.name
}

output "docker_push_commands" {
  value = <<-EOT

    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.app.repository_url}

    docker build -t ${var.app_name} .

    docker tag ${var.app_name}:latest ${aws_ecr_repository.app.repository_url}:latest

    docker push ${aws_ecr_repository.app.repository_url}:latest

    aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.app.name} --force-new-deployment --region ${var.aws_region}

  EOT
}
