#include <iostream>
#include <complex>
#include <vector>

const double sqrt2 = sqrt(2.0);
const double sqrt2_inv = 1.0 / sqrt2;

class Matrix
{
public:
    Matrix() {}

    inline Matrix(char c)
    {
        if (c == 'I')
        {
            data[0][0] = 1;
            data[0][1] = 0;
            data[1][0] = 0;
            data[1][1] = 1;
        }
        else if (c == 'H')
        {
            data[0][0] = 1.00000;
            data[0][1] = 1.00000;
            data[1][0] = 1.00000;
            data[1][1] = -1.00000;
            powOFsqrt2_inv = 1;
        }
        else if (c == 'X')
        {
            data[0][0] = 0;
            data[0][1] = 1;
            data[1][0] = 1;
            data[1][1] = 0;
        }
        else if (c == 'Y')
        {
            data[0][0] = 0;
            data[0][1] = -std::complex<double>(0, 1);
            data[1][0] = std::complex<double>(0, 1);
            data[1][1] = 0;
        }
        else if (c == 'Z')
        {
            data[0][0] = 1;
            data[0][1] = 0;
            data[1][0] = 0;
            data[1][1] = -1;
        }
        else if (c == 'S')
        {
            data[0][0] = 1;
            data[0][1] = 0;
            data[1][0] = 0;
            data[1][1] = std::complex<double>(0, 1);
        }
    }
        /*
        X*X=I
        Z*X=i*Y
        X*Y=Z
        Y*Y=I
        Z*Y=-i*X
        Y*Z=i*X
        Z*Z=I
        X*S=-i*Y
        S*S=Z
        H*H=I
        */

        inline std::complex<double> get(int i, int j) const
        {
            return data[i][j];
        }
        inline size_t getPower() const
        {
            return powOFsqrt2_inv;
        }

        inline void set(int i, int j, std::complex<double> value)
        {
            data[i][j] = value;
        }
        inline void setPower(size_t i)
        {
            powOFsqrt2_inv = i;
        }

        inline Matrix operator+(const Matrix &other) const
        {
            Matrix result;
            // std::complex<double> a11, a12, a21, a22,
            //     b11, b12, b21, b22;
            // a11 = this->get(0, 0);
            // a12 = this->get(0, 1);
            // a21 = this->get(1, 0);
            // a22 = this->get(1, 1);
            // b11 = other.get(0, 0);
            // b12 = other.get(0, 1);
            // b21 = other.get(1, 0);
            // b22 = other.get(1, 1);
            // result.set(0, 0, a11 + b11);
            // result.set(0, 1, a12 + b12);
            // result.set(1, 0, a21 + b21);
            // result.set(1, 1, a22 + b22);
            // return result;
            // Matrix result;
            for (int i = 0; i < 2; ++i) {
                for (int j = 0; j < 2; ++j) {
                    result.set(i, j, this->get(i, j) + other.get(i, j));
                }
            }
            return result;
        }

        inline Matrix operator*(const Matrix &other) const
        {
            Matrix result;
            result.setPower(this->getPower() + other.getPower());
            std::complex<double> k_=1.0000000;
            if(result.getPower()>=2)
            {
                result.setPower(result.getPower() - 2);
                k_=0.5000000;
            }
            for(int i = 0; i < 2; i++) {
                for(int k = 0; k < 2; k++) {
                    for (int j = 0; j < 2; j++) {
                        result.set(i, j,result.get(i, j) + k_*(this->get(i, k) * other.get(k, j)));
                    }
                }
            }
            return result;
            // std::complex<double> a11, a12, a21, a22,
            //     b11, b12, b21, b22;
            // a11 = this->get(0, 0);
            // a12 = this->get(0, 1);
            // a21 = this->get(1, 0);
            // a22 = this->get(1, 1);
            // b11 = other.get(0, 0);
            // b12 = other.get(0, 1);
            // b21 = other.get(1, 0);
            // b22 = other.get(1, 1);
            // result.set(0, 0, a11 * b11 + a12 * b21);
            // result.set(0, 1, a11 * b12 + a12 * b22);
            // result.set(1, 0, a21 * b11 + a22 * b21);
            // result.set(1, 1, a21 * b12 + a22 * b22);
            // result.setPower(this->getPower() + other.getPower());
            // return result;
            
        }
    inline void print() const {
        for (int i = 0; i < 2; ++i) {
            for (int j = 0; j < 2; ++j) {
                printf("data[%d][%d] = std::complex<double>(%f, %f); ", i, j, data[i][j].real(), data[i][j].imag());
            }
            printf("\n");
        }
        if(powOFsqrt2_inv != 0)
            printf("powOFsqrt2_inv = %zu;\n", powOFsqrt2_inv);
    }
    private:
        std::complex<double> data[2][2];
        size_t powOFsqrt2_inv = 0;
};

int main(int argc, char const *argv[])
{
    freopen("output.cpp", "w", stdout);
    printf("Matrix(char a, char b){\n");
    printf("if(a=='X'){\n");
    printf("    if(b=='X'){\n");
    (Matrix('X')*Matrix('X')).print();
    printf("    }else if(b=='Y'){\n");
    (Matrix('X')*Matrix('Y')).print();
    printf("    }else if(b=='Z'){\n");
    (Matrix('X')*Matrix('Z')).print();
    printf("    }else if(b=='S'){\n");
    (Matrix('X')*Matrix('S')).print();
    printf("    }else if(b=='H'){\n");
    (Matrix('X')*Matrix('H')).print();
    printf("    }\n");
    printf("}\n");

    printf("else if(a=='Y'){\n");
    printf("    if(b=='X'){\n");
    (Matrix('Y')*Matrix('X')).print();
    printf("    }else if(b=='Y'){\n");
    (Matrix('Y')*Matrix('Y')).print();
    printf("    }else if(b=='Z'){\n");
    (Matrix('Y')*Matrix('Z')).print();
    printf("    }else if(b=='S'){\n");
    (Matrix('Y')*Matrix('S')).print();
    printf("    }else if(b=='H'){\n");
    (Matrix('Y')*Matrix('H')).print();
    printf("    }\n");
    printf("}\n");
    printf("else if(a=='Z'){\n");
    printf("    if(b=='X'){\n");
    (Matrix('Z')*Matrix('X')).print();
    printf("    }else if(b=='Y'){\n");
    (Matrix('Z')*Matrix('Y')).print();
    printf("    }else if(b=='Z'){\n");
    (Matrix('Z')*Matrix('Z')).print();
    printf("    }else if(b=='S'){\n");
    (Matrix('Z')*Matrix('S')).print();
    printf("    }else if(b=='H'){\n");
    (Matrix('Z')*Matrix('H')).print();
    printf("    }\n");
    printf("}\n");
    printf("else if(a=='S'){\n");
    printf("    if(b=='X'){\n");
    (Matrix('S')*Matrix('X')).print();
    printf("    }else if(b=='Y'){\n");
    (Matrix('S')*Matrix('Y')).print();
    printf("    }else if(b=='Z'){\n");
    (Matrix('S')*Matrix('Z')).print();
    printf("    }else if(b=='S'){\n");
    (Matrix('S')*Matrix('S')).print();
    printf("    }else if(b=='H'){\n");
    (Matrix('S')*Matrix('H')).print();
    printf("    }\n");
    printf("}\n");
    printf("else if(a=='H'){\n");
    printf("    if(b=='X'){\n");
    (Matrix('H')*Matrix('X')).print();
    printf("    }else if(b=='Y'){\n");
    (Matrix('H')*Matrix('Y')).print();
    printf("    }else if(b=='Z'){\n");
    (Matrix('H')*Matrix('Z')).print();
    printf("    }else if(b=='S'){\n");
    (Matrix('H')*Matrix('S')).print();
    printf("    }else if(b=='H'){\n");
    (Matrix('H')*Matrix('H')).print();
    printf("    }\n");
    printf("}\n");
    printf("}\n");
    return 0;
}