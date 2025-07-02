#include <bits/stdc++.h>
using namespace std;
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
        for (int i = 0; i < 2; ++i)
        {
            for (int j = 0; j < 2; ++j)
            {
                result.set(i, j, this->get(i, j) + other.get(i, j));
            }
        }
        return result;
    }

    inline Matrix operator*(const Matrix &other) const
    {
        Matrix result;
        result.setPower(this->getPower() + other.getPower());
        std::complex<double> k_ = 1.0000000;
        if (result.getPower() >= 2)
        {
            result.setPower(result.getPower() - 2);
            k_ = 0.5000000;
        }
        for (int i = 0; i < 2; i++)
        {
            for (int k = 0; k < 2; k++)
            {
                for (int j = 0; j < 2; j++)
                {
                    result.set(i, j, result.get(i, j) + k_ * (this->get(i, k) * other.get(k, j)));
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
    inline void print() const
    {
        if (powOFsqrt2_inv != 0)
            printf("powOFsqrt2_inv = %zu;\n", powOFsqrt2_inv);
        for (int i = 0; i < 2; ++i)
        {
            for (int j = 0; j < 2; ++j)
            {
                printf("%f+%fi ", data[i][j].real(), data[i][j].imag());
            }
            printf("\n");
        }
    }
    inline std::pair<bool, std::complex<double>> div(Matrix other) const
    {
        std::complex<double> k =  complex<double>(0, 0);
        for (int i = 0; i < 2; ++i)
        {
            for (int j = 0; j < 2; ++j)
            {
                if (other.get(i, j) == complex<double>(0, 0) && this->get(i, j) !=  complex<double>(0, 0))
                    return {false,  complex<double>(0, 0)};
                if (other.get(i, j) !=  complex<double>(0, 0))
                {
                    if (k ==  complex<double>(0, 0))
                    {
                        k = this->get(i, j) / other.get(i, j);
                    }
                    else if (k != this->get(i, j) / other.get(i, j))
                    {
                        return {false,  complex<double>(0, 0)};
                    }
                }
            }
        }
        return {true, k};
    }
    inline Matrix mul(complex<double> k){
        Matrix result;
        for (int i = 0; i < 2; ++i)
        {
            for (int j = 0; j < 2; ++j)
            {
                result.set(i, j, this->get(i, j)*k);
            }
        }
        return result;
    }
    inline Matrix T()
    {
        Matrix result;
        for (int i = 0; i < 2; ++i)
        {
            for (int j = 0; j < 2; ++j)
            {
                result.set(j, i, this->get(i, j));
            }
        }
        return result;
    }

private:
    std::complex<double> data[2][2];
    size_t powOFsqrt2_inv = 0;
};

vector<string> names = {"I", "H", "X", "Y", "Z", "S",
                        "H_inv", "X_inv", "Y_inv", "Z_inv", "S_inv"};
queue<string> q;
map<string, Matrix> mp = {
    {"I", Matrix('I')},
    {"H", Matrix('H')},
    {"X", Matrix('X')},
    {"Y", Matrix('Y')},
    {"Z", Matrix('Z')},
    {"S", Matrix('S')},
    {"H_inv", Matrix('H').T()},
    {"X_inv", Matrix('X').T()},
    {"Y_inv", Matrix('Y').T()},
    {"Z_inv", Matrix('Z').T()},
    {"S_inv", Matrix('S').T()}};

struct relation
{
    string A, B, C;
    complex<double> k;
    relation(string a, string b, string c, complex<double> k) : A(a), B(b), C(c), k(k) {}
};
vector<relation> graph;
char stack[100];
int main(int argc, char const *argv[])
{
    freopen("output.txt", "w", stdout);
    int id = 0;
    q.push("X");
    q.push("Y");
    q.push("Z");
    q.push("H");
    q.push("S");
    q.push("X_inv");
    q.push("Y_inv");
    q.push("Z_inv");
    q.push("H_inv");
    q.push("S_inv");
    while (!q.empty())
    {
        string now = q.front();
        q.pop();
        for (string a : names)
        {
            Matrix nn = mp[now] * mp[a];
            int fl = 0;
            for (string b : names)
            {
                pair<bool, complex<double>> test = nn.div(mp[b]);
                if (test.first == true)
                {
                    graph.push_back(relation(now, a, b, test.second));
                        fl = 1;
                    break;
                }
            }
            if (fl == 0)
            {
                string s="New"+id;
                names.push_back(s);
                names.push_back(s+"_inv");
                id++;
                mp["New" + id] = nn;
                mp["New" + id + "_inv"] = nn.T();
            }
            nn = mp[a] * mp[now];
            fl = 0;
            for (string b : names)
            {
                pair<bool, complex<double>> test = nn.div(mp[b]);
                if (test.first == true)
                {
                    graph.push_back(relation(a, now, b, test.second));
                    fl = 1;
                    break;
                }
            }
            if (fl == 0)
            {
                names.push_back("New" + id);
                names.push_back("New" + id + "_inv");
                id++;
                mp["New" + id] = nn;
                mp["New" + id + "_inv"] = nn.T();
            }
        }
    }
    for(relation re : graph)
    {
        cout << re.A << " * " << re.B << " = " << re.C << " * " << re.k << endl;
        mp[re.A].print();
        mp[re.B].print();
        mp[re.C].print();
        (mp[re.A]*mp[re.B]).print();
        mp[re.C].mul( re.k).print();
    }
    return 0;
}
