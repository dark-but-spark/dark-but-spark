.include "macro_print_str.asm"
.data
.text
    li a1,1
    li a2,1
    for_i:
        li a2,1
        for_j:
            mul a3,a1,a2
            mv a0,a1
            li a7,1
            ecall
            print_string(" * ")
            mv a0,a2
            li a7,1
            ecall
            print_string(" = ")
            mv a0,a3
            li a7,1
            ecall
            print_string(" ")
            addi a2,a2,1
            ble a2,a1,for_j
        print_string("\n")
        addi a1,a1,1
        li a4,10
        blt a1,a4,for_i
    li a7,10
    ecall
        
