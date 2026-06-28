import rclpy
from rclpy.node import Node

class MinimalPublisher(Node):
    def __init__(self):
        super().__init__('meca_psi_test_node')
        self.get_logger().info('¡Conexión exitosa! ROS 2 Humble está vivo y escuchando en el ecosistema MecaPsi.')

def main(args=None):
    rclpy.init(args=args)
    minimal_publisher = MinimalPublisher()
    
    # Destruir el nodo explícitamente y apagar
    minimal_publisher.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
