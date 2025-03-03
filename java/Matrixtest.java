class Matrix{
    private int row;
    private int colunm;
    private double a[][];
    
    Matrix()
    {
    }

    Matrix(int row,int colunm,double value[][])
    {
        this.row=row;
        this.colunm=colunm;
        this.a=value;
    }

    Matrix(String s,int n) throws Exception
    {
        if(s=="I")
        {
            this.colunm=this.row=n;
            this.a= new double[n][n];
            for(int i=0;i<n;i++) for(int j=0;j<n;j++)
            {
                if(i==j) this.a[i][j]=1;
                else this.a[i][j]=0;
            }
        }
        else
        {
            throw new Exception("fuck Matrix");
        }
    }
    int height()
    {
        return this.row;
    }
    int width()
    {
        return this.colunm;
    }

    String print()
    {
        StringBuilder s=new StringBuilder();
        s.append("\r\n");
        for(int i=0;i<this.row;i++) for(int j=0;j<this.colunm;j++)
        {
            s.append(a[i][j]);
            if(j==this.colunm-1)
                s.append("\r\n");
            else 
                s.append(" ");
        }
        s.append("------------------");
        return s.toString();
    }
    public Matrix plus(Matrix that) throws Exception
    {
        if(this.row!=that.row||this.colunm!=that.colunm)
            throw new Exception("fuck plus or minus");
        else 
        {
            double result[][]=new double[this.row][this.colunm];
            for(int i=0;i<this.row;i++) for(int j=0;j<this.colunm;j++)
            {
                result[i][j]=this.a[i][j]+that.a[i][j];
            }
            return new Matrix(this.row,this.colunm,result);
       }
    }
    public Matrix multiply(double x) throws Exception //x*this
    {
        double result[][]= new double[this.row][this.colunm];
        for(int i=0;i<this.row;i++) for(int j=0;j<this.colunm;j++)
        {
            result[i][j]=x*this.a[i][j];
        }
        return new Matrix(this.row,this.colunm,result);
    }
    public Matrix minus(Matrix that) // this - that
    {
        try
        {
            Matrix res=this.plus(that.multiply(-1));
            return res;
        }
        catch (Exception e) 
        {
            e.printStackTrace();
            return  new Matrix();
        }

    }
    public Matrix multiply(Matrix that) throws Exception // this * that 
    {
        if(this.colunm!=that.row) 
            throw new Exception("fuck multiply");
        else
        {
            double res[][]= new double[this.row][that.colunm];
            for(int i=0;i<this.row;i++) for(int j=0;j<that.colunm;j++) for(int k=0;k<that.row;k++)
            {
                res[i][j]+=this.a[i][k]*that.a[k][j];
            }
            return new Matrix(this.row,that.colunm,res);
        }
    }
    public Matrix T()
    {
        double res[][]=new double[this.colunm][this.row];
        for(int i=0;i<this.colunm;i++) for(int j=0;j<this.row;j++)
        {
            res[i][j]=this.a[j][i];
        }
        return new Matrix(this.colunm,this.row,res);
    }
    /* traditional way
    public int order(int[] a)
    {
        int ans=1;
        for(int i=0;i<a.length;i++) for(int j=i+1;j<a.length;j++)
        {
            if(a[i]>a[j]) ans*=-1;
        }
        return ans;
    }
    public double choose(int d,int[] f,int[] a )
    {
        if(d==this.row)
        {
            double ans=1;
            for(int i=0;i<this.row;i++)
            {
                ans*=this.a[i][a[i]];
            }
            return order(a)*ans;
        }
        else
        {
            double ans=0;
            for(int i=0;i<this.row;i++)
            {
                if(f[i]==0)
                {
                    f[i]=1;
                    a[d]=i;
                    ans+=choose(d+1,f,a);
                    f[i]=0;
                }
            }
            return ans;
        }
    }
    */
    public Matrix rowchange(int r_1,int x_1,int r_2,int x_2) throws CloneNotSupportedException // r_1=r_1*x_1+r_2*x_2
    {
        Matrix res= (Matrix) this.clone();
        for(int i=0;i<this.colunm;i++)
        {
            res.a[r_1][i]=this.a[r_1][i]*x_1+this.a[r_2][i]*x_2;
        }
        return res;
    }
    public Matrix colunmchange(int c_1,int x_1,int c_2,int x_2) throws CloneNotSupportedException // c_1=c_1*x_1+c_2*x_2
    {
        Matrix res= (Matrix) this.clone();
        for(int i=0;i<this.row;i++)
        {
            res.a[i][c_1]=this.a[i][c_1]*x_1+this.a[i][c_2]*x_2;
        }
        return res;
    }
    public double det() throws Exception
    {
        if(this.row!=this.colunm) 
        {
            throw new Exception("can't caculate det");
        }
        else
        {
            /*  traditional way
            int n=this.row;
            int f[]=new int[n];
            int a[]=new int[n];
            return choose(0,f,a);
            */
           

        }
                return colunm;
    }
}
class Matrixtest{
    public static void main(String[] args) {
        double a[][] = {{2,1,0,0}, {1,2,1,0}, {0,1,2,1},{0,0,1,2}};
        double b[][] = {{2,-1,0,0}, {-1,2,-1,0}, {0,-1,2,-1},{0,0,-1,2}};
        double d[][] = {{2}, {0}, {5}};
        double f[][] = {{2,3},{4,5}};
        double m[][]= new double[4][4];
        try 
        {
        Matrix A = new Matrix(a.length, a[0].length, a);
        Matrix B = new Matrix(b.length, b[0].length, b);
        Matrix C = new Matrix("I",4);
        Matrix D = new Matrix(d.length, d[0].length, d);
        Matrix E = new Matrix("I",2);
        Matrix F= new Matrix(f.length,f[0].length,f);
       
            System.out.println("A=" + A.print());
            System.out.println("B=" + B.print());
            System.out.println("C=" + C.print());
            System.out.println("D=" + D.print());
            System.out.println("E=" + E.print());
            System.out.println("A+C="+A.plus(C).print());
            // System.out.println("A+E="+A.plus(E).print());
            // System.out.println("B+D="+B.plus(D).print());
            System.out.println("3*A="+A.multiply(3).print());
            System.out.println("A-C="+A.minus(C).print());
            System.out.println("B-D="+B.minus(D).print());
            // System.out.println("A-D="+A.minus(D).print());
            System.out.println("A*C="+A.multiply(C).print());
            System.out.println("A*B="+A.multiply(B).print());
            // System.out.println("B*A="+B.multiply(A).print());
            System.out.println("A^T="+A.T().print());
            System.out.println("B^T="+B.T().print());
            for(int i=0;i<16;i++)
            {
                int x=i,k=0;
                while(k<4)
                {
                    if(x%2==1) m[k][k]=1;
                    else m[k][k]=-1;
                    x>>=1;
                    k+=1;
                }
                Matrix M= new Matrix(4,4,m);
                System.out.println("M=" + M.print());
                System.out.println("MAM="+M.multiply(A.multiply(M)).print());
            }
            System.out.println("detF="+F.det());
            // System.out.println("detD="+D.det());
            System.out.println("detE="+E.det());
            
            
        }
        catch (Exception e) 
        {
            e.printStackTrace();
        }
    }
}