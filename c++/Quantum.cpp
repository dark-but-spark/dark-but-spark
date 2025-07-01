#include <iostream>
#include <complex>
#include <vector>

const double sqrt2 = sqrt(2.0);
const double sqrt2_inv = 1.0 / sqrt2;

class Matrix {
public:
    Matrix(){}

    inline Matrix(char c) {
        if (c == 'I') {
            data[0][0] = 1; data[0][1] = 0;
            data[1][0] = 0; data[1][1] = 1;
        } else if (c == 'H') {
            data[0][0] = 1/sqrt2; data[0][1] = 1/sqrt2;
            data[1][0] = 1/sqrt2; data[1][1] = -1/sqrt2;
            // powOFsqrt2_inv = 1;
        } else if (c == 'X') { 
            data[0][0] = 0; data[0][1] = 1;
            data[1][0] = 1; data[1][1] = 0;
        } else if (c == 'Y') {
            data[0][0] = 0; data[0][1] = -std::complex<double>(0, 1);
            data[1][0] = std::complex<double>(0, 1); data[1][1] = 0;
        } else if (c == 'Z') {
            data[0][0] = 1; data[0][1] = 0;
            data[1][0] = 0; data[1][1] = -1;
        } else if (c == 'S') {
            data[0][0] = 1; data[0][1] = 0;
            data[1][0] = 0; data[1][1] = std::complex<double>(0, 1);
        }
    }
    //X*X=I
    //X*Y=Z
    //X*S=-i*Y
    //Y*Y=I
    //Y*Z=i*X
    //Z*X=i*Y
    //Z*Y=-i*X
    //Z*Z=I
    //S*S=Z
    //H*H=I


    


    inline std::complex<double> get(int i, int j) const {
        return data[i][j];
    }
    inline size_t getPower() const {
        return powOFsqrt2_inv;
    }

    inline void set(int i, int j, std::complex<double> value) {
        data[i][j] = value;
    }
    inline void setPower(size_t i){
        powOFsqrt2_inv = i;
    }

    inline Matrix operator+(const Matrix& other) const {
        Matrix result;
        std::complex<double> a11,a12,a21,a22,
            b11,b12,b21,b22;
        a11 = this->get(0, 0); a12 = this->get(0, 1);
        a21 = this->get(1, 0); a22 = this->get(1, 1);
        b11 = other.get(0, 0); b12 = other.get(0, 1);
        b21 = other.get(1, 0); b22 = other.get(1, 1);
        result.set(0, 0, a11 + b11);
        result.set(0, 1, a12 + b12);
        result.set(1, 0, a21 + b21);
        result.set(1, 1, a22 + b22);
        return result;
        // Matrix result;
        // for (int i = 0; i < 2; ++i) {
        //     for (int j = 0; j < 2; ++j) {
        //         result.set(i, j, this->get(i, j) + other.get(i, j));
        //     }
        // }
        // return result;
    }

    inline Matrix operator*(const Matrix& other) const {
        Matrix result;
        std::complex<double> a11,a12,a21,a22,
            b11,b12,b21,b22;
        a11 = this->get(0, 0); a12 = this->get(0, 1);
        a21 = this->get(1, 0); a22 = this->get(1, 1);
        b11 = other.get(0, 0); b12 = other.get(0, 1);
        b21 = other.get(1, 0); b22 = other.get(1, 1);
        result.set(0, 0, a11 * b11 + a12 * b21);
        result.set(0, 1, a11 * b12 + a12 * b22);
        result.set(1, 0, a21 * b11 + a22 * b21);
        result.set(1, 1, a21 * b12 + a22 * b22);
        result.setPower(this->getPower() + other.getPower());
        return result;
        // Matrix result;
        // for(int i = 0; i < 2; i++) {
        //     for(int k = 0; k < 2; k++) {
        //         for (int j = 0; j < 2; j++) {
        //             result.set(i, j, result.get(i, j) + this->get(i, k) * other.get(k, j));
        //         }
        //     }
        // }
        // return result;
    }
    inline void print() const {
        printf("Matrix:\n");
        for (int i = 0; i < 2; ++i) {
            for (int j = 0; j < 2; ++j) {
                printf("%8.2f%+8.2fi ", data[i][j].real(), data[i][j].imag());
            }
            printf("\n");
        }
    }

private:
    std::complex<double> data[2][2];
    size_t powOFsqrt2_inv=0;
};
int main(int argc, char const *argv[])
{
    printf("X*X");
    (Matrix('X')*Matrix('X')).print();
    printf("X*Y");
    (Matrix('X')*Matrix('Y')).print();
    printf("X*Z");
    (Matrix('X')*Matrix('Z')).print();
    printf("X*S");
    (Matrix('X')*Matrix('S')).print();
    printf("X*H");
    (Matrix('X')*Matrix('H')).print();
    puts("-------------------");
    printf("Y*X");
    (Matrix('Y')*Matrix('X')).print(); 
    printf("Y*Y");
    (Matrix('Y')*Matrix('Y')).print();
    printf("Y*Z");
    (Matrix('Y')*Matrix('Z')).print();
    printf("Y*S");
    (Matrix('Y')*Matrix('S')).print();
    printf("Y*H");
    (Matrix('Y')*Matrix('H')).print();
    puts("-------------------");
    printf("Z*X");
    (Matrix('Z')*Matrix('X')).print();
    printf("Z*Y");
    (Matrix('Z')*Matrix('Y')).print();
    printf("Z*Z");
    (Matrix('Z')*Matrix('Z')).print();
    printf("Z*S");
    (Matrix('Z')*Matrix('S')).print();
    printf("Z*H");
    (Matrix('Z')*Matrix('H')).print();
    puts("-------------------");
    printf("S*X");
    (Matrix('S')*Matrix('X')).print();
    printf("S*Y");
    (Matrix('S')*Matrix('Y')).print();
    printf("S*Z");
    (Matrix('S')*Matrix('Z')).print();
    printf("S*S");
    (Matrix('S')*Matrix('S')).print();
    printf("S*H");
    (Matrix('S')*Matrix('H')).print();
    puts("-------------------");
    printf("H*X");
    (Matrix('H')*Matrix('X')).print();
    printf("H*Y");
    (Matrix('H')*Matrix('Y')).print();
    printf("H*Z");
    (Matrix('H')*Matrix('Z')).print();
    printf("H*S");
    (Matrix('H')*Matrix('S')).print();
    printf("H*H");
    (Matrix('H')*Matrix('H')).print();
    puts("-------------------");
    
    return 0;
}
