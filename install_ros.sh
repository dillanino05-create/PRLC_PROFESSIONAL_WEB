#!/bin/bash
set -e

echo "=== Configurando Locales ==="
apt-get update && apt-get install -y locales
locale-gen en_US en_US.UTF-8
update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8

echo "=== Agregando repositorios de Ubuntu ==="
apt-get install -y software-properties-common curl
add-apt-repository universe -y

echo "=== Agregando llaves de ROS 2 ==="
curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | tee /etc/apt/sources.list.d/ros2.list > /dev/null

echo "=== Instalando ROS 2 Humble (Base) ==="
apt-get update
apt-get upgrade -y
DEBIAN_FRONTEND=noninteractive apt-get install -y ros-humble-ros-base python3-argcomplete python3-colcon-common-extensions

echo "=== Configuración Finalizada ==="
