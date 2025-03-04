#include <stdio.h>

void _start() {
    printf("Hello, World!\n");
    __asm__ ("mov $60, %eax\n"
             "xor %edi, %edi\n"
             "syscall");   
}